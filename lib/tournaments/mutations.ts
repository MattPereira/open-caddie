import { revalidatePath } from "next/cache";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";

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
import { invalidateHomeEventsCache } from "@/lib/home/cache";
import {
  insertEventRounds,
  invalidateRoundChanged,
  syncEventRounds,
  type ChangedRound,
} from "@/lib/rounds/lifecycle";
import { requireAdmin } from "@/lib/users/admin";

// Tournament and Season writes. Plain module: route actions authenticate and
// parse untrusted input, then pass the session user id in (ADR 0003).

export type TournamentWriteResult =
  | { ok: true; id?: number }
  | { ok: false; error: string };

type TournamentInput = {
  clubHandle: string;
  /** yyyy-mm-dd */
  date: string;
  courseHandle: string;
  teeId: number;
};

export type TournamentCreateInput = TournamentInput & {
  /** Null places the Tournament in the Club's Current Season. */
  seasonId: number | null;
  startNextSeason: boolean;
};

export type TournamentUpdateInput = TournamentInput & {
  id: number;
  seasonId: number;
};

const NOT_ADMIN = "Only admins can manage Tournaments.";

export async function createTournament(
  userId: string,
  values: TournamentCreateInput,
): Promise<TournamentWriteResult> {
  const admin = await requireAdmin(userId, NOT_ADMIN);
  if (!admin.ok) return admin;

  const resolved = await resolveTournamentFields(values);
  if (!resolved.ok) return resolved;
  const { clubId, courseId } = resolved;

  try {
    const tournament = await db.transaction(async (tx) => {
      await tx.execute(sql`select id from clubs where id = ${clubId} for update`);
      let season = values.seasonId == null ? null : await getSeason(tx, values.seasonId, clubId);

      if (values.startNextSeason) {
        const current = await getCurrentSeason(tx, clubId);
        [season] = await tx.insert(seasons).values({ clubId, number: (current?.number ?? 0) + 1 }).returning();
      } else if (!season) {
        season = await getCurrentSeason(tx, clubId);
        if (!season) [season] = await tx.insert(seasons).values({ clubId, number: 1 }).returning();
      }

      const [created] = await tx.insert(tournaments).values({
        seasonId: season.id,
        date: parseDateOnly(values.date),
        courseId,
        teeId: values.teeId,
      }).returning({ id: tournaments.id });
      return created;
    });

    invalidateTournamentChanged(tournament.id);
    return { ok: true, id: tournament.id };
  } catch (e: unknown) {
    return writeFailure(e, "Could not create Tournament.");
  }
}

export async function updateTournament(
  userId: string,
  values: TournamentUpdateInput,
): Promise<TournamentWriteResult> {
  const admin = await requireAdmin(userId, NOT_ADMIN);
  if (!admin.ok) return admin;

  const { id } = values;
  const clubId = await getClubIdByHandle(values.clubHandle);
  const courseId = await getCourseIdByHandle(values.courseHandle);
  if (!clubId || !courseId) {
    return { ok: false, error: "Selected club or course does not exist." };
  }

  if (!(await isTeeForCourse(values.teeId, courseId))) {
    return { ok: false, error: "Selected tee does not belong to this course." };
  }

  let synced: ChangedRound[];
  try {
    const result = await db.transaction(async (tx) => {
      const [previous] = await tx
        .select({ courseId: tournaments.courseId, teeId: tournaments.teeId, date: tournaments.date })
        .from(tournaments)
        .where(eq(tournaments.id, id))
        .for("update");
      if (!previous) return null;

      const season = await getSeason(tx, values.seasonId, clubId);
      await tx.update(tournaments).set({
        seasonId: season.id,
        date: parseDateOnly(values.date),
        courseId,
        teeId: values.teeId,
      }).where(eq(tournaments.id, id));
      return syncEventRounds(tx, { tournamentId: id }, previous);
    });
    if (!result) return { ok: false, error: "Tournament not found." };
    synced = result;
  } catch (e: unknown) {
    return writeFailure(e, "Could not update Tournament.");
  }

  if (synced.length > 0) invalidateRoundChanged(synced);
  invalidateTournamentChanged(id);
  return { ok: true };
}

/** Refused while the Tournament has Rounds, so played Rounds are never lost. */
export async function deleteTournament(
  userId: string,
  id: number,
): Promise<TournamentWriteResult> {
  const admin = await requireAdmin(userId, NOT_ADMIN);
  if (!admin.ok) return admin;

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
  invalidateTournamentChanged(id);
  return { ok: true };
}

/** Players already in the Tournament are skipped; `added` counts the rest. */
export async function addPlayersToTournament(
  userId: string,
  values: { tournamentId: number; userIds: string[] },
): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  const admin = await requireAdmin(userId, "Only admins can add players.");
  if (!admin.ok) return admin;

  const { tournamentId, userIds } = values;

  const [tournament] = await db
    .select({ id: tournaments.id })
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

  const inserted = await db.transaction((tx) =>
    insertEventRounds(tx, { tournamentId }, userIds),
  );

  // Home events and the Tournament page refresh even when no one was added.
  invalidateRoundChanged(inserted);
  invalidateHomeEventsCache();
  revalidatePath(`/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}/edit`);
  return { ok: true, added: inserted.length };
}

// The "Tournament changed" page set, separate from "Round changed".
function invalidateTournamentChanged(id: number) {
  invalidateHomeEventsCache();
  revalidatePath("/");
  revalidatePath("/tournaments");
  revalidatePath(`/tournaments/${id}`);
  revalidatePath(`/tournaments/${id}/edit`);
  revalidatePath("/clubs/[handle]", "page");
}

function writeFailure(e: unknown, fallback: string) {
  const code =
    (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
    (e as { code?: string })?.code;
  if (code === "23503") {
    return { ok: false as const, error: "Selected club or course does not exist." };
  }
  return { ok: false as const, error: e instanceof Error ? e.message : fallback };
}

async function resolveTournamentFields(values: TournamentInput) {
  const clubId = await getClubIdByHandle(values.clubHandle);
  const courseId = await getCourseIdByHandle(values.courseHandle);
  if (!clubId || !courseId) {
    return { ok: false as const, error: "Selected club or course does not exist." };
  }
  if (!(await isTeeForCourse(values.teeId, courseId))) {
    return { ok: false as const, error: "Selected tee does not belong to this course." };
  }
  return { ok: true as const, clubId, courseId };
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

type SeasonReader = Pick<typeof db, "select">;

// A Club's Current Season is its highest-numbered one; null until it has any.
async function getCurrentSeason(reader: SeasonReader, clubId: number) {
  const [season] = await reader.select().from(seasons).where(eq(seasons.clubId, clubId)).orderBy(desc(seasons.number)).limit(1);
  return season ?? null;
}

async function getSeason(reader: SeasonReader, seasonId: number, clubId: number) {
  const [season] = await reader.select().from(seasons).where(and(eq(seasons.id, seasonId), eq(seasons.clubId, clubId))).limit(1);
  if (!season) throw new Error("Selected Season does not belong to this Club.");
  return season;
}
