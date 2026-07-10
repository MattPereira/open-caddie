"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  courseHoles,
  courseTees,
  courses,
  rounds,
  teeYardages,
  tournaments,
} from "@/db/schema";
import { getCurrentUser } from "@/db/queries/users";
import { safeDeleteBlob } from "@/lib/blob";
import { parseScorecardImage } from "@/lib/ai/course-scorecard-parser";
import { DEFAULT_SCORECARD_MODEL } from "@/lib/ai/scorecard";
import {
  createCourseScorecardImport,
  type CourseScorecardImportView,
  type HoleCorrection,
  type TeeCorrection,
} from "@/lib/course-scorecard-import";
import {
  CourseCreateInputSchema,
  CourseUpdateSchema,
  type CourseCreateInputValues,
  type CourseUpdateValues,
  type TeeFormValues,
} from "./schema";

export type CourseScorecardImportResult =
  | { outcome: "published"; handle: string }
  | { outcome: "paused"; import: CourseScorecardImportView }
  | { outcome: "stale"; import: CourseScorecardImportView }
  | { outcome: "cancelled" }
  | { outcome: "rejected"; error: string };

type UpdateResult =
  | { ok: true; handle: string; renamed: boolean }
  | { ok: false; error: string };

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const me = await getCurrentUser();
  if (!me?.isAdmin) {
    throw new Error("Forbidden");
  }
  return me;
}

function normalizeColor(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeImgUrl(value: string): string | null {
  return value.length > 0 ? value : null;
}

function yardageRows(teeId: number, yardages: TeeFormValues["yardages"]) {
  const rows: { teeId: number; hole: number; yards: number }[] = [];
  yardages.forEach((value, index) => {
    if (typeof value === "number") {
      rows.push({ teeId, hole: index + 1, yards: value });
    }
  });
  return rows;
}

function pgCode(e: unknown): string | undefined {
  return (
    (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
    (e as { code?: string })?.code
  );
}

function revalidateCoursePaths(handles: string[]) {
  revalidatePath("/courses");
  revalidatePath("/clubs/[handle]", "page");
  for (const handle of handles) {
    revalidatePath(`/courses/${handle}`);
    revalidatePath(`/courses/${handle}/edit`);
  }
}

async function fetchImageBytes(
  url: string,
): Promise<{ buffer: Buffer; mediaType: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    const mediaType =
      response.headers.get("content-type")?.split(";")[0].trim() ||
      "image/webp";
    return { buffer, mediaType };
  } catch {
    return null;
  }
}

const courseScorecardImports = createCourseScorecardImport({
  async parseScorecardImage(stagedImageHandle) {
    const image = await fetchImageBytes(stagedImageHandle);
    if (!image) throw new Error("Could not retrieve staged scorecard image");
    const parsed = await parseScorecardImage(image.buffer, image.mediaType);
    return { scorecard: parsed.parsed, warnings: parsed.sumChecks, parserModel: DEFAULT_SCORECARD_MODEL };
  },
  async deleteStagedImage(handle) {
    return safeDeleteBlob(handle);
  },
});

/** Authenticated maintenance entrypoint; invoke daily from the scheduler. */
export async function cleanupExpiredCourseScorecardImports() {
  const actor = await getCurrentUser();
  if (!actor) return { outcome: "rejected" as const, error: "forbidden" };
  const result = await courseScorecardImports.cleanup({ actorId: actor.id });
  return result.outcome === "cleaned" ? result : { outcome: "rejected" as const, error: result.reason };
}

export async function cleanupExpiredCourseScorecardImportsFromScheduler() {
  return courseScorecardImports.cleanupSystem();
}

export async function startCourseScorecardImport(
  values: CourseCreateInputValues,
): Promise<CourseScorecardImportResult> {
  const actor = await getCurrentUser();
  if (!actor) return { outcome: "rejected", error: "forbidden" };
  const parsed = CourseCreateInputSchema.safeParse(values);
  if (!parsed.success) {
    return { outcome: "rejected", error: parsed.error.issues[0].message };
  }
  const result = await courseScorecardImports.start({
    actorId: actor.id,
    target: { kind: "new", name: parsed.data.name },
    stagedCourseImageHandle: parsed.data.imgUrl,
    stagedScorecardImageHandle: parsed.data.scorecardImgUrl,
  });
  if (result.outcome === "published") return { outcome: "published", handle: result.handle };
  if (result.outcome === "paused") return result;
  if (result.outcome === "cancelled") return result;
  if (result.outcome === "stale") return result;
  return { outcome: "rejected", error: result.reason };
}

export async function startExistingCourseScorecardImport(input: {
  courseId: number;
  stagedScorecardImageHandle: string;
}): Promise<CourseScorecardImportResult> {
  const actor = await getCurrentUser();
  if (!actor) return { outcome: "rejected", error: "forbidden" };
  const result = await courseScorecardImports.start({
    actorId: actor.id,
    target: { kind: "existing", courseId: input.courseId },
    stagedScorecardImageHandle: input.stagedScorecardImageHandle,
  });
  if (result.outcome === "published") return { outcome: "published", handle: result.handle };
  if (result.outcome === "paused" || result.outcome === "cancelled") return result;
  if (result.outcome === "stale") return result;
  return { outcome: "rejected", error: result.reason };
}

export async function cancelCourseScorecardImport(input: {
  importId: string;
  expectedRevision: number;
}): Promise<CourseScorecardImportResult> {
  const actor = await getCurrentUser();
  if (!actor) return { outcome: "rejected", error: "forbidden" };
  const result = await courseScorecardImports.continue({
    actorId: actor.id,
    importId: input.importId,
    expectedRevision: input.expectedRevision,
    intent: { kind: "cancel" },
  });
  if (result.outcome === "published") return { outcome: "published", handle: result.handle };
  if (result.outcome === "paused" || result.outcome === "cancelled") return result;
  if (result.outcome === "stale") return result;
  return { outcome: "rejected", error: result.reason };
}

export async function continueCourseScorecardImport(input: {
  importId: string;
  expectedRevision: number;
  teeMetadata?: Record<string, { rating: number; slope: number }>;
  acknowledgeWarnings?: string[];
  corrections?: {
    tees?: Record<string, TeeCorrection>;
    holes?: Record<string, HoleCorrection>;
  };
  excludeTees?: string[];
  teeResolutions?: Record<string, { kind: "new" } | { kind: "existing"; teeId: number }>;
  placeholderResolutions?: Record<string, { kind: "keep" } | { kind: "map"; teeId: string }>;
}): Promise<CourseScorecardImportResult> {
  const actor = await getCurrentUser();
  if (!actor) return { outcome: "rejected", error: "forbidden" };
  const result = await courseScorecardImports.continue({
    actorId: actor.id,
    importId: input.importId,
    expectedRevision: input.expectedRevision,
    intent: {
      kind: "resolve",
      teeMetadata: input.teeMetadata,
      acknowledgeWarnings: input.acknowledgeWarnings,
      corrections: input.corrections,
      excludeTees: input.excludeTees,
      teeResolutions: input.teeResolutions,
      placeholderResolutions: input.placeholderResolutions,
    },
  });
  if (result.outcome === "published") return { outcome: "published", handle: result.handle };
  if (result.outcome === "paused") return result;
  if (result.outcome === "cancelled") return result;
  if (result.outcome === "stale") return result;
  return { outcome: "rejected", error: result.reason };
}

export async function retryCourseScorecardImport(input: {
  importId: string;
  expectedRevision: number;
}): Promise<CourseScorecardImportResult> {
  const actor = await getCurrentUser();
  if (!actor) return { outcome: "rejected", error: "forbidden" };
  const result = await courseScorecardImports.continue({
    actorId: actor.id,
    importId: input.importId,
    expectedRevision: input.expectedRevision,
    intent: { kind: "retry_parsing" },
  });
  if (result.outcome === "published") return { outcome: "published", handle: result.handle };
  if (result.outcome === "paused" || result.outcome === "cancelled") return result;
  if (result.outcome === "stale") return result;
  return { outcome: "rejected", error: result.reason };
}

export async function replaceCourseScorecardImport(input: {
  importId: string;
  expectedRevision: number;
  stagedScorecardImageHandle: string;
}): Promise<CourseScorecardImportResult> {
  const actor = await getCurrentUser();
  if (!actor) return { outcome: "rejected", error: "forbidden" };
  const result = await courseScorecardImports.continue({
    actorId: actor.id,
    importId: input.importId,
    expectedRevision: input.expectedRevision,
    intent: { kind: "replace_scorecard_image", stagedScorecardImageHandle: input.stagedScorecardImageHandle },
  });
  if (result.outcome === "published") return { outcome: "published", handle: result.handle };
  if (result.outcome === "paused" || result.outcome === "cancelled") return result;
  if (result.outcome === "stale") return result;
  return { outcome: "rejected", error: result.reason };
}

export async function inspectCourseScorecardImport(
  importId: string,
): Promise<CourseScorecardImportResult> {
  const actor = await getCurrentUser();
  if (!actor) return { outcome: "rejected", error: "forbidden" };
  const result = await courseScorecardImports.inspect({ actorId: actor.id, importId });
  if (result.outcome === "paused") return result;
  if (result.outcome === "published") return { outcome: "published", handle: result.handle };
  if (result.outcome === "cancelled") return result;
  if (result.outcome === "stale") return result;
  return { outcome: "rejected", error: result.reason };
}

export async function updateCourse(
  values: CourseUpdateValues,
): Promise<UpdateResult> {
  await requireAdmin();

  const parsed = CourseUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { id, handle, name, imgUrl, tees, holes } = parsed.data;

  const [current] = await db
    .select({
      id: courses.id,
      handle: courses.handle,
      imgUrl: courses.imgUrl,
    })
    .from(courses)
    .where(eq(courses.id, id))
    .limit(1);
  if (!current) {
    return { ok: false, error: "Course not found." };
  }

  const existingTees = await db
    .select({ id: courseTees.id, name: courseTees.name })
    .from(courseTees)
    .where(eq(courseTees.courseId, id));

  const submittedTeeIds = new Set(
    tees.map((tee) => tee.id).filter((teeId): teeId is number => !!teeId),
  );
  const teesToDelete = existingTees.filter((tee) => !submittedTeeIds.has(tee.id));

  if (teesToDelete.length > 0) {
    const teeIds = teesToDelete.map((tee) => tee.id);
    const [tournamentBlockers, roundBlockers] = await Promise.all([
      db
        .select({ teeId: tournaments.teeId, value: count() })
        .from(tournaments)
        .where(inArray(tournaments.teeId, teeIds))
        .groupBy(tournaments.teeId),
      db
        .select({ teeId: rounds.teeId, value: count() })
        .from(rounds)
        .where(inArray(rounds.teeId, teeIds))
        .groupBy(rounds.teeId),
    ]);

    if (tournamentBlockers.length > 0 || roundBlockers.length > 0) {
      const nameById = new Map(teesToDelete.map((tee) => [tee.id, tee.name]));
      const messages: string[] = [];
      for (const row of tournamentBlockers) {
        messages.push(
          `${nameById.get(row.teeId) ?? "Tee"}: ${row.value} tournament(s)`,
        );
      }
      for (const row of roundBlockers) {
        messages.push(
          `${nameById.get(row.teeId) ?? "Tee"}: ${row.value} round(s)`,
        );
      }
      return {
        ok: false,
        error: `Cannot remove tees in use — ${messages.join("; ")}`,
      };
    }
  }

  const newImgUrl = normalizeImgUrl(imgUrl);

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(courses)
        .set({
          handle,
          name,
          imgUrl: newImgUrl,
        })
        .where(eq(courses.id, id));

      if (teesToDelete.length > 0) {
        await tx
          .delete(courseTees)
          .where(
            and(
              eq(courseTees.courseId, id),
              inArray(
                courseTees.id,
                teesToDelete.map((tee) => tee.id),
              ),
            ),
          );
      }

      for (const [index, tee] of tees.entries()) {
        const sortOrder = index;
        let teeId = tee.id;

        if (teeId) {
          await tx
            .update(courseTees)
            .set({
              name: tee.name,
              color: normalizeColor(tee.color),
              rating: tee.rating,
              slope: tee.slope,
              sortOrder,
            })
            .where(
              and(eq(courseTees.id, teeId), eq(courseTees.courseId, id)),
            );
          await tx.delete(teeYardages).where(eq(teeYardages.teeId, teeId));
        } else {
          const [inserted] = await tx
            .insert(courseTees)
            .values({
              courseId: id,
              name: tee.name,
              color: normalizeColor(tee.color),
              rating: tee.rating,
              slope: tee.slope,
              sortOrder,
            })
            .returning({ id: courseTees.id });
          teeId = inserted.id;
        }

        const yardages = yardageRows(teeId, tee.yardages);
        if (yardages.length > 0) {
          await tx.insert(teeYardages).values(yardages);
        }
      }

      await tx.delete(courseHoles).where(eq(courseHoles.courseId, id));
      await tx.insert(courseHoles).values(
        holes.map((hole) => ({
          courseId: id,
          hole: hole.hole,
          par: hole.par,
          handicap: hole.handicap,
        })),
      );
    });
  } catch (e: unknown) {
    if (pgCode(e) === "23505") {
      return {
        ok: false,
        error: "A course or tee with that name already exists.",
      };
    }
    throw e;
  }

  if (current.imgUrl !== newImgUrl) {
    await safeDeleteBlob(current.imgUrl);
  }
  const renamed = current.handle !== handle;
  revalidateCoursePaths(renamed ? [current.handle, handle] : [handle]);
  return { ok: true, handle, renamed };
}

export async function deleteCourse(id: number): Promise<ActionResult> {
  await requireAdmin();

  const [{ value: tournamentCount }] = await db
    .select({ value: count() })
    .from(tournaments)
    .where(eq(tournaments.courseId, id));

  if (tournamentCount > 0) {
    return {
      ok: false,
      error: `Cannot delete: course is assigned to ${tournamentCount} tournament(s).`,
    };
  }

  const [{ value: roundCount }] = await db
    .select({ value: count() })
    .from(rounds)
    .where(eq(rounds.courseId, id));

  if (roundCount > 0) {
    return {
      ok: false,
      error: `Cannot delete: course is assigned to ${roundCount} round(s).`,
    };
  }

  const [current] = await db
    .select({
      handle: courses.handle,
      imgUrl: courses.imgUrl,
      scorecardImgUrl: courses.scorecardImgUrl,
    })
    .from(courses)
    .where(eq(courses.id, id))
    .limit(1);

  await db.delete(courses).where(eq(courses.id, id));

  if (current) {
    await safeDeleteBlob(current.imgUrl);
    await safeDeleteBlob(current.scorecardImgUrl);
    revalidateCoursePaths([current.handle]);
  } else {
    revalidateCoursePaths([]);
  }

  return { ok: true };
}
