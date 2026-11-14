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
import { invalidateHomeEventsCache } from "@/lib/home/cache";
import { safeDeleteBlob } from "@/lib/images/blob";
import { pgCode } from "@/lib/pg-errors";
import { requirePlatformAdmin } from "@/modules/players";

// Course writes. Plain module: route actions authenticate and parse untrusted
// input, then pass the acting Player's id in (ADR 0003).

/** Parsed course form values; blank strings mean "none". */
export type CourseUpdateInput = {
  id: number;
  handle: string;
  name: string;
  imgUrl: string;
  tees: {
    /** Absent for a new tee. Existing tees left out are removed. */
    id?: number;
    name: string;
    color: string;
    rating: string;
    slope: number;
    /** One per hole; `""` for an unknown yardage. */
    yardages: (number | "")[];
    sortOrder: number;
  }[];
  holes: { hole: number; par: number; handicap: number }[];
};

export type CourseUpdateResult =
  | { ok: true; handle: string; renamed: boolean }
  | { ok: false; error: string };

export type CourseDeleteResult = { ok: true } | { ok: false; error: string };

export async function updateCourse(
  actingPlayerId: string,
  values: CourseUpdateInput,
): Promise<CourseUpdateResult> {
  const admin = await requirePlatformAdmin(
    actingPlayerId,
    "Only Platform Admins can edit courses.",
  );
  if (!admin.ok) return admin;

  const { id, handle, name, imgUrl, tees, holes } = values;

  const [current] = await db
    .select({ handle: courses.handle, imgUrl: courses.imgUrl })
    .from(courses)
    .where(eq(courses.id, id))
    .limit(1);
  if (!current) return { ok: false, error: "Course not found." };

  const existingTees = await db
    .select({ id: courseTees.id, name: courseTees.name })
    .from(courseTees)
    .where(eq(courseTees.courseId, id));
  const submittedTeeIds = new Set(tees.map((tee) => tee.id).filter((teeId) => teeId != null));
  const teesToDelete = existingTees.filter((tee) => !submittedTeeIds.has(tee.id));

  const refused = await refuseIfTeesInUse(teesToDelete);
  if (refused) return refused;

  const newImgUrl = imgUrl.length > 0 ? imgUrl : null;

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(courses)
        .set({ handle, name, imgUrl: newImgUrl })
        .where(eq(courses.id, id));

      if (teesToDelete.length > 0) {
        await tx.delete(courseTees).where(
          and(
            eq(courseTees.courseId, id),
            inArray(
              courseTees.id,
              teesToDelete.map((tee) => tee.id),
            ),
          ),
        );
      }

      for (const [sortOrder, tee] of tees.entries()) {
        const fields = {
          name: tee.name,
          color: emptyToNull(tee.color),
          rating: tee.rating,
          slope: tee.slope,
          sortOrder,
        };
        let teeId = tee.id;
        if (teeId) {
          await tx
            .update(courseTees)
            .set(fields)
            .where(and(eq(courseTees.id, teeId), eq(courseTees.courseId, id)));
          await tx.delete(teeYardages).where(eq(teeYardages.teeId, teeId));
        } else {
          const [inserted] = await tx
            .insert(courseTees)
            .values({ courseId: id, ...fields })
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
  } catch (e) {
    if (pgCode(e) === "23505") {
      return { ok: false, error: "A course or tee with that name already exists." };
    }
    throw e;
  }

  if (current.imgUrl !== newImgUrl) {
    await safeDeleteBlob(current.imgUrl);
  }
  const renamed = current.handle !== handle;
  invalidateHomeEventsCache();
  revalidateCoursePaths(renamed ? [current.handle, handle] : [handle]);
  return { ok: true, handle, renamed };
}

export async function deleteCourse(
  actingPlayerId: string,
  id: number,
): Promise<CourseDeleteResult> {
  const admin = await requirePlatformAdmin(
    actingPlayerId,
    "Only Platform Admins can delete courses.",
  );
  if (!admin.ok) return admin;

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

  // No Tournaments means no Events, so home events don't need refreshing.
  const [deleted] = await db
    .delete(courses)
    .where(eq(courses.id, id))
    .returning({
      handle: courses.handle,
      imgUrl: courses.imgUrl,
      scorecardImgUrl: courses.scorecardImgUrl,
    });

  if (deleted) {
    await safeDeleteBlob(deleted.imgUrl);
    await safeDeleteBlob(deleted.scorecardImgUrl);
  }
  revalidateCoursePaths(deleted ? [deleted.handle] : []);
  return { ok: true };
}

async function refuseIfTeesInUse(
  tees: { id: number; name: string }[],
): Promise<{ ok: false; error: string } | null> {
  if (tees.length === 0) return null;

  const teeIds = tees.map((tee) => tee.id);
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
  if (tournamentBlockers.length === 0 && roundBlockers.length === 0) return null;

  const nameById = new Map(tees.map((tee) => [tee.id, tee.name]));
  const messages = [
    ...tournamentBlockers.map(
      (row) => `${nameById.get(row.teeId) ?? "Tee"}: ${row.value} tournament(s)`,
    ),
    ...roundBlockers.map(
      (row) => `${nameById.get(row.teeId) ?? "Tee"}: ${row.value} round(s)`,
    ),
  ];
  return { ok: false, error: `Cannot remove tees in use — ${messages.join("; ")}` };
}

function revalidateCoursePaths(handles: string[]) {
  revalidatePath("/courses");
  revalidatePath("/clubs/[handle]", "page");
  for (const handle of handles) {
    revalidatePath(`/courses/${handle}`);
    revalidatePath(`/courses/${handle}/edit`);
  }
}

function yardageRows(teeId: number, yardages: CourseUpdateInput["tees"][number]["yardages"]) {
  return yardages.flatMap((yards, index) =>
    typeof yards === "number" ? [{ teeId, hole: index + 1, yards }] : [],
  );
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
