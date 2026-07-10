"use server";

import {
  GatewayAuthenticationError,
  GatewayError,
  GatewayModelNotFoundError,
  GatewayRateLimitError,
} from "@ai-sdk/gateway";
import { revalidatePath } from "next/cache";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
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
import { isVercelBlobUrl, safeDeleteBlob } from "@/lib/blob";
import { courseHandleFromName } from "@/lib/course-handle";
import { parseScorecardImage } from "@/lib/ai/course-scorecard-parser";
import {
  createCourseScorecardImport,
  type CourseScorecardImportView,
} from "@/lib/course-scorecard-import";
import {
  CourseCreateFinalizeSchema,
  CourseCreateInputSchema,
  CourseUpdateSchema,
  type CourseCreateFinalizeValues,
  type CourseCreateInputValues,
  type CourseUpdateValues,
  type FinalizedScorecard,
  type TeeFormValues,
} from "./schema";

export type CreateResult =
  | { ok: true; handle: string; sumCheckIssues: string[] }
  | { ok: false; error: string }
  | {
      ok: false;
      needsTeeMeta: true;
      input: CourseCreateInputValues;
      draft: FinalizedScorecardDraft;
      sumCheckIssues: string[];
    };

export type NewCourseImportResult =
  | { outcome: "published"; handle: string }
  | { outcome: "paused"; import: CourseScorecardImportView }
  | { outcome: "cancelled" }
  | { outcome: "rejected"; error: string };

// Parser output reshaped for the client: rating/slope present when the parser
// found them, undefined when it didn't. Yardages are kept as numbers.
export type FinalizedScorecardDraft = {
  tees: Array<{
    name: string;
    color?: string;
    rating?: number;
    slope?: number;
    yardages: number[];
  }>;
  holes: Array<{ hole: number; par: number; handicap: number }>;
};

type CourseTeeForForm = {
  id: number;
  name: string;
  color: string | null;
  rating: string;
  slope: number;
  sortOrder: number;
  yardages: (number | null)[];
};

type UpdateResult =
  | { ok: true; handle: string; renamed: boolean }
  | { ok: false; error: string };

type ApplyScorecardImageResult =
  | {
      ok: true;
      handle: string;
      scorecardImgUrl: string;
      tees: CourseTeeForForm[];
      needsTeeMeta?: false;
    }
  | {
      ok: true;
      handle: string;
      scorecardImgUrl: string;
      tees: CourseTeeForForm[];
      needsTeeMeta: true;
      draft: FinalizedScorecardDraft;
    }
  | { ok: false; error: string };

type ReplacePlaceholderTeeResult =
  | { ok: true; tees: CourseTeeForForm[] }
  | { ok: false; error: string };

type ExistingCourseTeeMetaResult =
  | { ok: true; tees: CourseTeeForForm[] }
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

function normalizeTeeName(value: string): string {
  return value.trim().toLowerCase();
}

function isPlaceholderTeeName(value: string): boolean {
  const normalized = normalizeTeeName(value);
  return normalized === "unknown" || normalized === "unkown";
}

function normalizeImgUrl(value: string): string | null {
  return value.length > 0 ? value : null;
}

function getScorecardParseErrorMessage(error: unknown): string {
  if (GatewayAuthenticationError.isInstance(error)) {
    return "Scorecard parsing is not authenticated. Set AI_GATEWAY_API_KEY or refresh the Vercel AI Gateway credentials, then try again.";
  }

  if (GatewayRateLimitError.isInstance(error)) {
    return "Scorecard parsing is rate limited by the AI Gateway. Wait a moment and try again.";
  }

  if (GatewayModelNotFoundError.isInstance(error)) {
    return "Scorecard parsing is unavailable because the configured AI model is not available.";
  }

  if (GatewayError.isInstance(error) && error.statusCode === 403) {
    return "Scorecard parsing is unavailable because the AI Gateway rejected the model request. Check AI Gateway credits or credentials, then try again.";
  }

  return "Could not parse the scorecard image. Make sure it's cropped to just the scorecard table and try again.";
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

async function getCourseTeesForForm(
  courseId: number,
  tx: Pick<typeof db, "select"> = db,
): Promise<CourseTeeForForm[]> {
  const tees = await tx
    .select({
      id: courseTees.id,
      name: courseTees.name,
      color: courseTees.color,
      rating: courseTees.rating,
      slope: courseTees.slope,
      sortOrder: courseTees.sortOrder,
    })
    .from(courseTees)
    .where(eq(courseTees.courseId, courseId))
    .orderBy(asc(courseTees.sortOrder), asc(courseTees.id));
  const teeIds = tees.map((tee) => tee.id);
  const yardageRows =
    teeIds.length > 0
      ? await tx
          .select({
            teeId: teeYardages.teeId,
            hole: teeYardages.hole,
            yards: teeYardages.yards,
          })
          .from(teeYardages)
          .where(inArray(teeYardages.teeId, teeIds))
      : [];

  const yardagesByTee = new Map<number, (number | null)[]>();
  for (const tee of tees) {
    yardagesByTee.set(tee.id, Array<number | null>(18).fill(null));
  }
  for (const row of yardageRows) {
    const yardages = yardagesByTee.get(row.teeId);
    if (yardages && row.hole >= 1 && row.hole <= 18) {
      yardages[row.hole - 1] = row.yards;
    }
  }

  return tees.map((tee) => ({
    ...tee,
    yardages: yardagesByTee.get(tee.id) ?? Array<number | null>(18).fill(null),
  }));
}

async function upsertParsedTeesByName({
  courseId,
  parsedTees,
  tx,
}: {
  courseId: number;
  parsedTees: FinalizedScorecardDraft["tees"];
  tx: Pick<typeof db, "select" | "insert" | "update" | "delete">;
}) {
  const missingMetaTees: FinalizedScorecardDraft["tees"] = [];
  const existingTees = await tx
    .select({
      id: courseTees.id,
      name: courseTees.name,
      rating: courseTees.rating,
      slope: courseTees.slope,
    })
    .from(courseTees)
    .where(eq(courseTees.courseId, courseId));
  const existingTeeByName = new Map(
    existingTees.map((tee) => [normalizeTeeName(tee.name), tee]),
  );

  for (const [parsedIndex, parsedTee] of parsedTees.entries()) {
    if (isPlaceholderTeeName(parsedTee.name)) continue;

    const normalizedName = normalizeTeeName(parsedTee.name);
    const existingTee = existingTeeByName.get(normalizedName);
    const rating =
      parsedTee.rating ?? (existingTee ? Number(existingTee.rating) : undefined);
    const slope = parsedTee.slope ?? existingTee?.slope;

    if (rating == null || slope == null) {
      missingMetaTees.push(parsedTee);
      continue;
    }

    if (existingTee) {
      await tx
        .update(courseTees)
        .set({
          name: parsedTee.name,
          color: parsedTee.color ?? null,
          rating:
            parsedTee.rating == null ? existingTee.rating : String(parsedTee.rating),
          slope,
          sortOrder: parsedIndex,
        })
        .where(
          and(eq(courseTees.id, existingTee.id), eq(courseTees.courseId, courseId)),
        );
      await tx.delete(teeYardages).where(eq(teeYardages.teeId, existingTee.id));
      await tx.insert(teeYardages).values(
        parsedTee.yardages.map((yards, index) => ({
          teeId: existingTee.id,
          hole: index + 1,
          yards,
        })),
      );
    } else {
      const [inserted] = await tx
        .insert(courseTees)
        .values({
          courseId,
          name: parsedTee.name,
          color: parsedTee.color ?? null,
          rating: String(rating),
          slope,
          sortOrder: parsedIndex,
        })
        .returning({ id: courseTees.id });
      await tx.insert(teeYardages).values(
        parsedTee.yardages.map((yards, index) => ({
          teeId: inserted.id,
          hole: index + 1,
          yards,
        })),
      );
      existingTeeByName.set(normalizedName, {
        id: inserted.id,
        name: parsedTee.name,
        rating: String(rating),
        slope,
      });
    }
  }

  return missingMetaTees;
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

/**
 * Best-effort cleanup of blobs uploaded by the create-course form but never
 * saved (e.g. user clicked Cancel). Limited to image uploads under `courses/`.
 */
export async function deleteDraftBlobs(urls: string[]): Promise<void> {
  await requireAdmin();
  for (const url of urls) {
    if (!isVercelBlobUrl(url)) continue;
    try {
      const path = new URL(url).pathname.replace(/^\/+/, "");
      if (!/^courses\/[^/]+\/image-\d+[^/]*\.webp$/.test(path)) {
        continue;
      }
    } catch {
      continue;
    }
    await safeDeleteBlob(url);
  }
}

function slugify(name: string): string {
  return courseHandleFromName(name);
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
    return { scorecard: parsed.parsed, warnings: parsed.sumChecks };
  },
});

export async function startNewCourseScorecardImport(
  values: CourseCreateInputValues,
): Promise<NewCourseImportResult> {
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
  return { outcome: "rejected", error: result.reason };
}

export async function cancelNewCourseScorecardImport(input: {
  importId: string;
  expectedRevision: number;
}): Promise<NewCourseImportResult> {
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
  return { outcome: "rejected", error: result.reason };
}

export async function continueNewCourseScorecardImport(input: {
  importId: string;
  expectedRevision: number;
  teeMetadata?: Record<string, { rating: number; slope: number }>;
  acknowledgeWarnings?: string[];
}): Promise<NewCourseImportResult> {
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
    },
  });
  if (result.outcome === "published") return { outcome: "published", handle: result.handle };
  if (result.outcome === "paused") return result;
  if (result.outcome === "cancelled") return result;
  return { outcome: "rejected", error: result.reason };
}

export async function inspectNewCourseScorecardImport(
  importId: string,
): Promise<NewCourseImportResult> {
  const actor = await getCurrentUser();
  if (!actor) return { outcome: "rejected", error: "forbidden" };
  const result = await courseScorecardImports.inspect({ actorId: actor.id, importId });
  if (result.outcome === "paused") return result;
  if (result.outcome === "published") return { outcome: "published", handle: result.handle };
  if (result.outcome === "cancelled") return result;
  return { outcome: "rejected", error: result.reason };
}

type CreateCourseArgs =
  | CourseCreateInputValues
  | CourseCreateFinalizeValues;

function isFinalizeArgs(
  values: CreateCourseArgs,
): values is CourseCreateFinalizeValues {
  return (
    typeof (values as CourseCreateFinalizeValues).scorecardData === "object" &&
    (values as CourseCreateFinalizeValues).scorecardData !== null
  );
}

export async function createCourse(
  values: CreateCourseArgs,
): Promise<CreateResult> {
  await requireAdmin();

  // Branch 1: client is finalizing a previous parse with rating/slope filled.
  if (isFinalizeArgs(values)) {
    const parsed = CourseCreateFinalizeSchema.safeParse(values);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0].message };
    }
    const {
      name,
      imgUrl,
      scorecardImgUrl,
      scorecardData,
    } = parsed.data;
    return insertCourseFromScorecard({
      name,
      imgUrl,
      scorecardImgUrl,
      scorecard: scorecardData,
      sumCheckIssues: [],
    });
  }

  // Branch 2: first submit — parse the scorecard image.
  const parsed = CourseCreateInputSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { name, imgUrl, scorecardImgUrl } = parsed.data;

  const handleCheck = await checkHandle(name);
  if (!handleCheck.ok) return handleCheck;

  const image = await fetchImageBytes(scorecardImgUrl);
  if (!image) {
    return {
      ok: false,
      error: "Could not retrieve the scorecard image. Please try uploading again.",
    };
  }

  let parsedScorecard;
  let sumCheckIssues: string[];
  try {
    const result = await parseScorecardImage(image.buffer, image.mediaType);
    parsedScorecard = result.parsed;
    sumCheckIssues = result.sumChecks;
  } catch (e) {
    console.error("[createCourse] parse failed", e);
    return {
      ok: false,
      error: getScorecardParseErrorMessage(e),
    };
  }

  const draft: FinalizedScorecardDraft = {
    tees: parsedScorecard.tees.map((tee) => ({
      name: tee.name,
      color: tee.color,
      rating: tee.rating,
      slope: tee.slope,
      yardages: tee.yardages,
    })),
    holes: parsedScorecard.holes,
  };

  const needsMeta = draft.tees.some(
    (tee) => tee.rating == null || tee.slope == null,
  );
  if (needsMeta) {
    return {
      ok: false,
      needsTeeMeta: true,
      input: { name, imgUrl, scorecardImgUrl },
      draft,
      sumCheckIssues,
    };
  }

  // Safe to coerce — every tee has rating/slope now.
  const scorecard: FinalizedScorecard = {
    tees: draft.tees.map((tee) => ({
      name: tee.name,
      color: tee.color,
      rating: tee.rating!,
      slope: tee.slope!,
      yardages: tee.yardages,
    })),
    holes: draft.holes,
  };

  return insertCourseFromScorecard({
    name,
    imgUrl,
    scorecardImgUrl,
    scorecard,
    sumCheckIssues,
  });
}

async function checkHandle(
  name: string,
): Promise<{ ok: true; handle: string } | { ok: false; error: string }> {
  const handle = slugify(name);
  if (handle.length === 0) {
    return {
      ok: false,
      error: "Course name must contain letters or numbers.",
    };
  }
  const [existing] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.handle, handle))
    .limit(1);
  if (existing) {
    return {
      ok: false,
      error:
        "A course with this name already exists. Pick a slightly different name to differentiate them.",
    };
  }
  return { ok: true, handle };
}

async function insertCourseFromScorecard(args: {
  name: string;
  imgUrl: string;
  scorecardImgUrl: string;
  scorecard: FinalizedScorecard;
  sumCheckIssues: string[];
}): Promise<CreateResult> {
  const { name, imgUrl, scorecardImgUrl, scorecard, sumCheckIssues } = args;

  const handleCheck = await checkHandle(name);
  if (!handleCheck.ok) return handleCheck;
  const { handle } = handleCheck;

  try {
    await db.transaction(async (tx) => {
      const [course] = await tx
        .insert(courses)
        .values({
          handle,
          name,
          imgUrl,
          scorecardImgUrl,
        })
        .returning({ id: courses.id });

      for (const [index, tee] of scorecard.tees.entries()) {
        const [insertedTee] = await tx
          .insert(courseTees)
          .values({
            courseId: course.id,
            name: tee.name,
            color: tee.color ?? null,
            rating: String(tee.rating),
            slope: tee.slope,
            sortOrder: index,
          })
          .returning({ id: courseTees.id });

        const yardages = tee.yardages
          .map((yards, i) => ({
            teeId: insertedTee.id,
            hole: i + 1,
            yards,
          }))
          .filter((row) => Number.isInteger(row.yards) && row.yards > 0);
        if (yardages.length > 0) {
          await tx.insert(teeYardages).values(yardages);
        }
      }

      await tx.insert(courseHoles).values(
        scorecard.holes.map((hole) => ({
          courseId: course.id,
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
        error:
          "A course with this name already exists. Pick a slightly different name to differentiate them.",
      };
    }
    throw e;
  }

  revalidateCoursePaths([handle]);
  return { ok: true, handle, sumCheckIssues };
}

export async function updateCourse(
  values: CourseUpdateValues,
): Promise<UpdateResult> {
  await requireAdmin();

  const parsed = CourseUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { id, handle, name, imgUrl, scorecardImgUrl, tees, holes } =
    parsed.data;

  const [current] = await db
    .select({
      id: courses.id,
      handle: courses.handle,
      imgUrl: courses.imgUrl,
      scorecardImgUrl: courses.scorecardImgUrl,
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
  const newScorecardImgUrl = normalizeImgUrl(scorecardImgUrl);

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(courses)
        .set({
          handle,
          name,
          imgUrl: newImgUrl,
          scorecardImgUrl: newScorecardImgUrl,
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
  if (current.scorecardImgUrl !== newScorecardImgUrl) {
    await safeDeleteBlob(current.scorecardImgUrl);
  }

  const renamed = current.handle !== handle;
  revalidateCoursePaths(renamed ? [current.handle, handle] : [handle]);
  return { ok: true, handle, renamed };
}

// Existing-course scorecard uploads are tee inventory syncs, not full course
// replacements. The parser may produce useful tee rows even when it cannot
// safely identify which row should inherit existing round/tournament history.
// For that reason this action:
// - saves the scorecard image,
// - adds or refreshes non-placeholder tees by normalized tee name,
// - reuses existing tee metadata by name when parser output lacks rating/slope,
// - returns a small metadata prompt for new tees still missing rating/slope,
// - intentionally leaves "Unknown" / "Unkown" placeholder tee ids untouched,
// - never updates course_holes par/handicap because those values are believed
//   correct and are used when displaying historical rounds.
// A separate explicit action below copies a chosen parsed tee onto the
// placeholder tee id after the admin clicks "Replace Unknown".
export async function applyScorecardImageToExistingCourse({
  courseId,
  scorecardImgUrl,
}: {
  courseId: number;
  scorecardImgUrl: string;
}): Promise<ApplyScorecardImageResult> {
  await requireAdmin();

  const parsedInput = z
    .object({
      courseId: z.number().int().positive(),
      scorecardImgUrl: z.url().max(2048),
    })
    .safeParse({ courseId, scorecardImgUrl });
  if (!parsedInput.success) {
    return { ok: false, error: parsedInput.error.issues[0].message };
  }

  const [current] = await db
    .select({
      id: courses.id,
      handle: courses.handle,
      scorecardImgUrl: courses.scorecardImgUrl,
    })
    .from(courses)
    .where(eq(courses.id, parsedInput.data.courseId))
    .limit(1);
  if (!current) {
    return { ok: false, error: "Course not found." };
  }

  const image = await fetchImageBytes(parsedInput.data.scorecardImgUrl);
  if (!image) {
    return {
      ok: false,
      error: "Could not retrieve the scorecard image. Please try uploading again.",
    };
  }

  let parsedScorecard;
  try {
    const result = await parseScorecardImage(image.buffer, image.mediaType);
    parsedScorecard = result.parsed;
  } catch (e) {
    console.error("[applyScorecardImageToExistingCourse] parse failed", e);
    return {
      ok: false,
      error: getScorecardParseErrorMessage(e),
    };
  }

  let missingMetaTees: FinalizedScorecardDraft["tees"] = [];
  const updatedTees = await db.transaction(async (tx) => {
    await tx
      .update(courses)
      .set({ scorecardImgUrl: parsedInput.data.scorecardImgUrl })
      .where(eq(courses.id, current.id));

    missingMetaTees = await upsertParsedTeesByName({
      courseId: current.id,
      parsedTees: parsedScorecard.tees,
      tx,
    });

    return getCourseTeesForForm(current.id, tx);
  });

  if (current.scorecardImgUrl !== parsedInput.data.scorecardImgUrl) {
    await safeDeleteBlob(current.scorecardImgUrl);
  }

  revalidateCoursePaths([current.handle]);
  if (missingMetaTees.length > 0) {
    return {
      ok: true,
      handle: current.handle,
      scorecardImgUrl: parsedInput.data.scorecardImgUrl,
      tees: updatedTees,
      needsTeeMeta: true,
      draft: {
        tees: missingMetaTees,
        holes: parsedScorecard.holes,
      },
    };
  }

  return {
    ok: true,
    handle: current.handle,
    scorecardImgUrl: parsedInput.data.scorecardImgUrl,
    tees: updatedTees,
  };
}

// Completes the upload sync for scorecards whose visible table omits
// rating/slope for new tee rows. Same-name tees were already handled by reusing
// existing metadata; this action only receives new parsed tee rows the admin
// supplied metadata for, then upserts them by name without touching holes or
// placeholder tee ids.
export async function finalizeExistingCourseScorecardTeeMeta({
  courseId,
  tees,
}: {
  courseId: number;
  tees: Array<{
    name: string;
    color?: string;
    rating: number;
    slope: number;
    yardages: number[];
  }>;
}): Promise<ExistingCourseTeeMetaResult> {
  await requireAdmin();

  const parsedInput = z
    .object({
      courseId: z.number().int().positive(),
      tees: z
        .array(
          z.object({
            name: z.string().trim().min(1).max(50),
            color: z.string().trim().max(30).optional(),
            rating: z.number().positive(),
            slope: z.number().int().min(55).max(155),
            yardages: z.array(z.number().int().positive()).length(18),
          }),
        )
        .min(1),
    })
    .safeParse({ courseId, tees });
  if (!parsedInput.success) {
    return { ok: false, error: parsedInput.error.issues[0].message };
  }

  const [current] = await db
    .select({ handle: courses.handle })
    .from(courses)
    .where(eq(courses.id, parsedInput.data.courseId))
    .limit(1);
  if (!current) {
    return { ok: false, error: "Course not found." };
  }

  try {
    const updatedTees = await db.transaction(async (tx) => {
      await upsertParsedTeesByName({
        courseId: parsedInput.data.courseId,
        parsedTees: parsedInput.data.tees,
        tx,
      });

      return getCourseTeesForForm(parsedInput.data.courseId, tx);
    });

    revalidateCoursePaths([current.handle]);
    return { ok: true, tees: updatedTees };
  } catch (e) {
    if (pgCode(e) === "23505") {
      return { ok: false, error: "A tee with that name already exists." };
    }
    throw e;
  }
}

// Preserve the placeholder tee id because rounds and tournaments can already
// reference it through restrictive foreign keys. The selected source tee is
// expected to be one of the parsed tee rows created by the upload sync above.
// It must be unused by rounds/tournaments, have all 18 yardages, and is deleted
// after its data is copied onto the placeholder id to avoid duplicate tee rows.
export async function replacePlaceholderTeeWithExistingTee({
  courseId,
  placeholderTeeId,
  sourceTeeId,
}: {
  courseId: number;
  placeholderTeeId: number;
  sourceTeeId: number;
}): Promise<ReplacePlaceholderTeeResult> {
  await requireAdmin();

  const parsedInput = z
    .object({
      courseId: z.number().int().positive(),
      placeholderTeeId: z.number().int().positive(),
      sourceTeeId: z.number().int().positive(),
    })
    .refine((value) => value.placeholderTeeId !== value.sourceTeeId, {
      message: "Choose a different tee to replace the placeholder.",
      path: ["sourceTeeId"],
    })
    .safeParse({ courseId, placeholderTeeId, sourceTeeId });
  if (!parsedInput.success) {
    return { ok: false, error: parsedInput.error.issues[0].message };
  }

  const [current] = await db
    .select({ handle: courses.handle })
    .from(courses)
    .where(eq(courses.id, parsedInput.data.courseId))
    .limit(1);
  if (!current) {
    return { ok: false, error: "Course not found." };
  }

  try {
    const updatedTees = await db.transaction(async (tx) => {
      const placeholder = await tx
        .select({
          id: courseTees.id,
          name: courseTees.name,
        })
        .from(courseTees)
        .where(
          and(
            eq(courseTees.id, parsedInput.data.placeholderTeeId),
            eq(courseTees.courseId, parsedInput.data.courseId),
          ),
        )
        .limit(1);
      const source = await tx
        .select({
          id: courseTees.id,
          name: courseTees.name,
          color: courseTees.color,
          rating: courseTees.rating,
          slope: courseTees.slope,
          sortOrder: courseTees.sortOrder,
        })
        .from(courseTees)
        .where(
          and(
            eq(courseTees.id, parsedInput.data.sourceTeeId),
            eq(courseTees.courseId, parsedInput.data.courseId),
          ),
        )
        .limit(1);

      const placeholderTee = placeholder[0];
      const sourceTee = source[0];
      if (!placeholderTee || !sourceTee) {
        throw new Error("Tee not found.");
      }
      if (!isPlaceholderTeeName(placeholderTee.name)) {
        throw new Error("Selected placeholder tee is no longer Unknown.");
      }

      const placeholderYardageCount = await tx
        .select({ value: count() })
        .from(teeYardages)
        .where(eq(teeYardages.teeId, placeholderTee.id));
      const tournamentReferences = await tx
        .select({ value: count() })
        .from(tournaments)
        .where(eq(tournaments.teeId, sourceTee.id));
      const roundReferences = await tx
        .select({ value: count() })
        .from(rounds)
        .where(eq(rounds.teeId, sourceTee.id));
      if ((placeholderYardageCount[0]?.value ?? 0) > 0) {
        throw new Error("Selected placeholder tee already has yardages.");
      }
      const sourceReferenceCount =
        (tournamentReferences[0]?.value ?? 0) +
        (roundReferences[0]?.value ?? 0);
      if (sourceReferenceCount > 0) {
        throw new Error(
          "Cannot replace Unknown with a tee already used by rounds or tournaments.",
        );
      }

      const sourceYardages = await tx
        .select({
          hole: teeYardages.hole,
          yards: teeYardages.yards,
        })
        .from(teeYardages)
        .where(eq(teeYardages.teeId, sourceTee.id))
        .orderBy(asc(teeYardages.hole));
      if (sourceYardages.length !== 18) {
        throw new Error("Selected tee must have all 18 yardages.");
      }

      await tx.delete(teeYardages).where(eq(teeYardages.teeId, sourceTee.id));
      await tx.delete(courseTees).where(eq(courseTees.id, sourceTee.id));
      await tx
        .update(courseTees)
        .set({
          name: sourceTee.name,
          color: sourceTee.color,
          rating: sourceTee.rating,
          slope: sourceTee.slope,
          sortOrder: sourceTee.sortOrder,
        })
        .where(eq(courseTees.id, placeholderTee.id));
      await tx.insert(teeYardages).values(
        sourceYardages.map((yardage) => ({
          teeId: placeholderTee.id,
          hole: yardage.hole,
          yards: yardage.yards,
        })),
      );

      return getCourseTeesForForm(parsedInput.data.courseId, tx);
    });

    revalidateCoursePaths([current.handle]);
    return { ok: true, tees: updatedTees };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not replace Unknown tee.",
    };
  }
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
