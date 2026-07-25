"use server";

import { revalidatePath } from "next/cache";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth";
import { db } from "@/db";
import {
  clubs,
  courseTees,
  courses,
  rounds,
  seasons,
  tournaments,
  users,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/users/queries";
import {
  TournamentCreateSchema,
  TournamentUpdateSchema,
  type TournamentCreateValues,
  type TournamentUpdateValues,
} from "./schema";

type ActionResult = { ok: true; id?: number } | { ok: false; error: string };

async function requireAdmin() {
  const me = await getCurrentUser();
  if (!me?.isAdmin) {
    throw new Error("Forbidden");
  }
  return me;
}

async function getClubIdByHandle(handle: string) {
  const [club] = await db
    .select({ id: clubs.id })
    .from(clubs)
    .where(eq(clubs.handle, handle))
    .limit(1);
  return club?.id ?? null;
}

async function getCourseIdByHandle(handle: string) {
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.handle, handle))
    .limit(1);
  return course?.id ?? null;
}

async function isTeeForCourse(teeId: number, courseId: number) {
  const [row] = await db
    .select({ id: courseTees.id })
    .from(courseTees)
    .where(and(eq(courseTees.id, teeId), eq(courseTees.courseId, courseId)))
    .limit(1);
  return row != null;
}

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function createTournament(
  values: TournamentCreateValues,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = TournamentCreateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { clubHandle } = parsed.data;
  const date = parseDateOnly(parsed.data.date);
  const courseHandle = parsed.data.courseHandle;
  const clubId = await getClubIdByHandle(clubHandle);
  const courseId = await getCourseIdByHandle(courseHandle);

  if (!clubId || !courseId) {
    return { ok: false, error: "Selected club or course does not exist." };
  }

  const teeId = parsed.data.teeId;
  const teeBelongsToCourse = await isTeeForCourse(teeId, courseId);
  if (!teeBelongsToCourse) {
    return { ok: false, error: "Selected tee does not belong to this course." };
  }

  try {
    const tournament = await createTournamentRecord({
      clubId,
      seasonId: parsed.data.seasonId === "" ? null : parsed.data.seasonId,
      startNextSeason: parsed.data.startNextSeason,
      date,
      courseId,
      teeId,
    });

    revalidatePath("/");
    revalidatePath("/tournaments");
    revalidatePath("/clubs/[handle]", "page");
    return { ok: true, id: tournament.id };
  } catch (e: unknown) {
    const code =
      (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (e as { code?: string })?.code;
    if (code === "23503") {
      return { ok: false, error: "Selected club or course does not exist." };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Could not create Tournament." };
  }
}

export async function updateTournament(
  values: TournamentUpdateValues,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = TournamentUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { id, clubHandle } = parsed.data;
  const date = parseDateOnly(parsed.data.date);
  const courseHandle = parsed.data.courseHandle;
  const clubId = await getClubIdByHandle(clubHandle);
  const courseId = await getCourseIdByHandle(courseHandle);

  if (!clubId || !courseId) {
    return { ok: false, error: "Selected club or course does not exist." };
  }

  const [current] = await db
    .select({ id: tournaments.id })
    .from(tournaments)
    .where(eq(tournaments.id, id))
    .limit(1);
  if (!current) {
    return { ok: false, error: "Tournament not found." };
  }

  const teeId = parsed.data.teeId;
  const teeBelongsToCourse = await isTeeForCourse(teeId, courseId);
  if (!teeBelongsToCourse) {
    return { ok: false, error: "Selected tee does not belong to this course." };
  }

  try {
    await updateTournamentRecord({ id, clubId, seasonId: parsed.data.seasonId as number, date, courseId, teeId });
  } catch (e: unknown) {
    const code =
      (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (e as { code?: string })?.code;
    if (code === "23503") {
      return { ok: false, error: "Selected club or course does not exist." };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Could not update Tournament." };
  }

  revalidatePath("/tournaments");
  revalidatePath(`/tournaments/${id}`);
  revalidatePath("/clubs/[handle]", "page");
  return { ok: true };
}

export async function deleteSeason(id: number): Promise<ActionResult> {
  await requireAdmin();
  try {
    await deleteSeasonRecord(id);
    revalidatePath("/tournaments");
    revalidatePath("/clubs/[handle]", "page");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not delete Season." };
  }
}

type TournamentFields = {
  clubId: number;
  seasonId: number | null;
  date: Date;
  courseId: number;
  teeId: number;
};

async function createTournamentRecord(values: TournamentFields & { startNextSeason: boolean }) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from clubs where id = ${values.clubId} for update`);
    let season = values.seasonId == null ? null : await getSeason(tx, values.seasonId, values.clubId);

    if (values.startNextSeason) {
      const [highest] = await tx.select({ number: seasons.number }).from(seasons).where(eq(seasons.clubId, values.clubId)).orderBy(desc(seasons.number)).limit(1);
      await tx.update(seasons).set({ isCurrent: false }).where(and(eq(seasons.clubId, values.clubId), eq(seasons.isCurrent, true)));
      [season] = await tx.insert(seasons).values({ clubId: values.clubId, number: (highest?.number ?? 0) + 1, isCurrent: true }).returning();
    } else if (!season) {
      [season] = await tx.select().from(seasons).where(and(eq(seasons.clubId, values.clubId), eq(seasons.isCurrent, true))).limit(1);
      if (!season) [season] = await tx.insert(seasons).values({ clubId: values.clubId, number: 1, isCurrent: true }).returning();
    }

    const [tournament] = await tx.insert(tournaments).values({
      clubId: season.clubId,
      seasonId: season.id,
      season: season.number,
      date: values.date,
      courseId: values.courseId,
      teeId: values.teeId,
    }).returning({ id: tournaments.id });
    return { id: tournament.id };
  });
}

async function updateTournamentRecord(values: TournamentFields & { id: number }) {
  if (values.seasonId == null) throw new Error("Season is required.");
  const season = await getSeason(db, values.seasonId, values.clubId);
  await db.update(tournaments).set({
    clubId: season.clubId,
    seasonId: season.id,
    season: season.number,
    date: values.date,
    courseId: values.courseId,
    teeId: values.teeId,
  }).where(eq(tournaments.id, values.id));
}

async function deleteSeasonRecord(seasonId: number) {
  return db.transaction(async (tx) => {
    const [season] = await tx.select().from(seasons).where(eq(seasons.id, seasonId)).limit(1);
    if (!season) throw new Error("Season not found.");
    await tx.execute(sql`select id from clubs where id = ${season.clubId} for update`);
    const [[highest], [{ value: tournamentCount }]] = await Promise.all([
      tx.select({ id: seasons.id }).from(seasons).where(eq(seasons.clubId, season.clubId)).orderBy(desc(seasons.number)).limit(1),
      tx.select({ value: count() }).from(tournaments).where(eq(tournaments.seasonId, seasonId)),
    ]);
    if (highest?.id !== seasonId) throw new Error("Only the highest-numbered Season can be deleted.");
    if (tournamentCount > 0) throw new Error("Only an empty Season can be deleted.");
    await tx.delete(seasons).where(eq(seasons.id, seasonId));
    const [previous] = await tx.select({ id: seasons.id }).from(seasons).where(eq(seasons.clubId, season.clubId)).orderBy(desc(seasons.number)).limit(1);
    if (previous) await tx.update(seasons).set({ isCurrent: true }).where(eq(seasons.id, previous.id));
  });
}

type SeasonReader = Pick<typeof db, "select">;

async function getSeason(reader: SeasonReader, seasonId: number, clubId: number) {
  const [season] = await reader.select().from(seasons).where(and(eq(seasons.id, seasonId), eq(seasons.clubId, clubId))).limit(1);
  if (!season) throw new Error("Selected Season does not belong to this Club.");
  return season;
}

export async function deleteTournament(id: number): Promise<ActionResult> {
  await requireAdmin();

  const [{ value: roundCount }] = await db
    .select({ value: count() })
    .from(rounds)
    .where(eq(rounds.tournamentId, id));

  if (roundCount > 0) {
    return {
      ok: false,
      error: `Cannot delete: tournament has ${roundCount} round(s).`,
    };
  }

  await db.delete(tournaments).where(eq(tournaments.id, id));
  revalidatePath("/tournaments");
  revalidatePath("/clubs/[handle]", "page");
  return { ok: true };
}

const AddPlayersSchema = z.object({
  tournamentId: z.number().int().positive(),
  userIds: z.array(z.string().min(1)).min(1),
});

export type AddPlayersValues = z.infer<typeof AddPlayersSchema>;

export async function addPlayersToTournament(
  values: AddPlayersValues,
): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = AddPlayersSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const [currentUser] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!currentUser?.isAdmin) {
    return { ok: false, error: "Only admins can add players." };
  }

  const { tournamentId, userIds } = parsed.data;

  const [tournament] = await db
    .select({
      id: tournaments.id,
      courseId: tournaments.courseId,
      teeId: tournaments.teeId,
      date: tournaments.date,
    })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!tournament) {
    return { ok: false, error: "Tournament not found." };
  }

  const existingUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, userIds));
  if (existingUsers.length !== new Set(userIds).size) {
    return { ok: false, error: "One or more selected players no longer exist." };
  }

  const inserted = await db
    .insert(rounds)
    .values(
      userIds.map((userId) => ({
        tournamentId,
        userId,
        courseId: tournament.courseId,
        teeId: tournament.teeId,
        date: tournament.date,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: rounds.id });

  revalidatePath("/");
  revalidatePath(`/tournaments/${tournamentId}`);
  return { ok: true, added: inserted.length };
}
