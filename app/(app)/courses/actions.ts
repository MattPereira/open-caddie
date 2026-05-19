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
import { isVercelBlobUrl, safeDeleteBlob } from "@/lib/blob";
import { parseScorecardImage } from "@/lib/scorecard-parser";
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
  revalidatePath("/admin");
  revalidatePath("/standings");
  for (const handle of handles) {
    revalidatePath(`/courses/${handle}`);
    revalidatePath(`/courses/${handle}/edit`);
  }
}

/**
 * Best-effort cleanup of draft blobs uploaded by the create-course form but
 * never saved (e.g. user clicked Cancel). Only deletes URLs whose path is
 * under `courses/draft-` to prevent misuse — never touches saved course
 * images or scorecards.
 */
export async function deleteDraftBlobs(urls: string[]): Promise<void> {
  await requireAdmin();
  for (const url of urls) {
    if (!isVercelBlobUrl(url)) continue;
    try {
      const path = new URL(url).pathname.replace(/^\/+/, "");
      if (!path.startsWith("courses/draft-")) continue;
    } catch {
      continue;
    }
    await safeDeleteBlob(url);
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
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
      error:
        "Could not parse the scorecard image. Make sure it's cropped to just the scorecard table and try again.",
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
