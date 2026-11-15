import { revalidatePath } from "next/cache";
import { count, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { clubs, rounds, tournaments, users } from "@/db/schema";
import { getCourseIdByHandle, isTeeForCourse } from "@/modules/courses";
import { parseDateOnly } from "@/lib/dates";
import { invalidateHomeEventsCache } from "@/lib/cache-tags";
import { pgCode } from "@/lib/pg-errors";
import {
  insertEventRounds,
  invalidateRoundChanged,
  syncEventRounds,
  type ChangedRound,
} from "@/modules/rounds/event-rounds";
import { requirePlatformAdmin } from "@/modules/players";
import {
  getOrCreateCurrentSeason,
  requireClubSeason,
  startNextSeason,
} from "@/modules/seasons";

// Tournament writes. Plain module: route actions authenticate and
// parse untrusted input, then pass the acting Player's id in
// (CODING_STANDARDS.md).

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
  /** Wins over `seasonId`. */
  startNextSeason: boolean;
};

export type TournamentUpdateInput = TournamentInput & {
  id: number;
  seasonId: number;
};

const NOT_ADMIN = "Only admins can manage Tournaments.";

export async function createTournament(
  playerId: string,
  values: TournamentCreateInput,
): Promise<TournamentWriteResult> {
  const admin = await requirePlatformAdmin(playerId, NOT_ADMIN);
  if (!admin.ok) return admin;

  const resolved = await resolveTournamentFields(values);
  if (!resolved.ok) return resolved;
  const { clubId, courseId } = resolved;

  try {
    const tournament = await db.transaction(async (tx) => {
      const season = values.startNextSeason
        ? await startNextSeason(tx, clubId)
        : values.seasonId != null
          ? await requireClubSeason(tx, values.seasonId, clubId)
          : await getOrCreateCurrentSeason(tx, clubId);

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
  playerId: string,
  values: TournamentUpdateInput,
): Promise<TournamentWriteResult> {
  const admin = await requirePlatformAdmin(playerId, NOT_ADMIN);
  if (!admin.ok) return admin;

  const { id } = values;
  const resolved = await resolveTournamentFields(values);
  if (!resolved.ok) return resolved;
  const { clubId, courseId } = resolved;

  let synced: ChangedRound[];
  try {
    const result = await db.transaction(async (tx) => {
      const [previous] = await tx
        .select({ courseId: tournaments.courseId, teeId: tournaments.teeId, date: tournaments.date })
        .from(tournaments)
        .where(eq(tournaments.id, id))
        .for("update");
      if (!previous) return null;

      const season = await requireClubSeason(tx, values.seasonId, clubId);
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
  playerId: string,
  id: number,
): Promise<TournamentWriteResult> {
  const admin = await requirePlatformAdmin(playerId, NOT_ADMIN);
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
  playerId: string,
  values: { tournamentId: number; playerIds: string[] },
): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  const admin = await requirePlatformAdmin(playerId, "Only admins can add players.");
  if (!admin.ok) return admin;

  const { tournamentId, playerIds } = values;

  const [tournament] = await db
    .select({ id: tournaments.id })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!tournament) {
    return { ok: false, error: "Tournament not found." };
  }

  const existingPlayers = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, playerIds));
  if (existingPlayers.length !== new Set(playerIds).size) {
    return { ok: false, error: "One or more selected players no longer exist." };
  }

  const inserted = await db.transaction((tx) =>
    insertEventRounds(tx, { tournamentId }, playerIds),
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
  if (pgCode(e) === "23503") {
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
