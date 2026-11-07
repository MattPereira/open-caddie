import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { courseTees, courses, matches, rounds, tournaments } from "@/db/schema";
import { invalidateHomeEventsCache } from "@/lib/home/cache";
import { readRoundAccess } from "./access";

// Owns whether a Round exists: every Round insert and delete goes through
// here. Not a "use server" module: public operations take the session user id
// (ADR 0003). The event helpers expect an already-authorized caller, take a
// transaction, and return the Rounds they changed so the caller can refresh
// after commit.

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** A Round as the "Round changed" refresh needs it. */
export type ChangedRound = {
  id: number;
  userId: string;
  tournamentId: number | null;
  matchId: number | null;
};

/** Matches have no tee column, so the caller supplies their starting tee. */
export type EventRef = { tournamentId: number } | { matchId: number; teeId: number };

export type CreateRoundValues = {
  courseHandle: string;
  /** yyyy-mm-dd */
  date: string;
  tournamentId: number | null;
  teeId: number | null;
};

export type CreateRoundResult =
  | { ok: true; roundId: number }
  | { ok: false; error: string };

export type RoundManageFailure =
  | { ok: false; reason: "not_found"; error: string }
  | { ok: false; reason: "cannot_manage"; error: string };

export type DeleteRoundResult = { ok: true } | RoundManageFailure;

export const ROUND_NOT_FOUND = {
  ok: false,
  reason: "not_found",
  error: "Round not found.",
} as const;
export const CANNOT_MANAGE_ROUND = {
  ok: false,
  reason: "cannot_manage",
  error: "You can't change this Round's settings.",
} as const;

const changedRoundColumns = {
  id: rounds.id,
  userId: rounds.userId,
  tournamentId: rounds.tournamentId,
  matchId: rounds.matchId,
};

/** Creates the user's own Round: casual, or joining a Tournament. */
export async function createRound(
  userId: string,
  values: CreateRoundValues,
): Promise<CreateRoundResult> {
  const { courseHandle, date, tournamentId, teeId: formTeeId } = values;

  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.handle, courseHandle))
    .limit(1);
  if (!course) {
    return { ok: false, error: "Course not found." };
  }

  let teeId: number | null = null;
  if (tournamentId != null) {
    const [tournament] = await db
      .select({
        id: tournaments.id,
        courseId: tournaments.courseId,
        teeId: tournaments.teeId,
      })
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))
      .limit(1);
    if (!tournament) {
      return { ok: false, error: "Tournament not found." };
    }
    if (tournament.courseId !== course.id) {
      return {
        ok: false,
        error: "Tournament course does not match selected course.",
      };
    }
    teeId = tournament.teeId;
  } else {
    if (formTeeId == null) {
      return { ok: false, error: "Tees are required." };
    }
    const [tee] = await db
      .select({ id: courseTees.id })
      .from(courseTees)
      .where(
        and(eq(courseTees.id, formTeeId), eq(courseTees.courseId, course.id)),
      )
      .limit(1);
    if (!tee) {
      return {
        ok: false,
        error: "Selected tees do not belong to this course.",
      };
    }
    teeId = formTeeId;
  }

  if (!teeId) {
    return { ok: false, error: "Selected course has no tees configured." };
  }

  let created: ChangedRound;
  try {
    [created] = await db
      .insert(rounds)
      .values({
        userId,
        courseId: course.id,
        teeId,
        tournamentId: tournamentId ?? null,
        date: new Date(`${date}T00:00:00.000Z`),
      })
      .returning(changedRoundColumns);
  } catch (e: unknown) {
    const code =
      (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (e as { code?: string })?.code;
    if (code === "23505") {
      return {
        ok: false,
        error: "You already have a round for this tournament.",
      };
    }
    throw e;
  }

  invalidateRoundsAddedOrRemoved([created]);
  return { ok: true, roundId: created.id };
}

/** Only the Round's player or an admin may delete it. */
export async function deleteRound(
  userId: string,
  roundId: number,
): Promise<DeleteRoundResult> {
  const access = await readRoundAccess(userId, roundId);
  if (!access?.canScore) return ROUND_NOT_FOUND;
  if (!access.canManage) return CANNOT_MANAGE_ROUND;

  const deleted = await db
    .delete(rounds)
    .where(eq(rounds.id, roundId))
    .returning(changedRoundColumns);
  if (deleted.length === 0) return ROUND_NOT_FOUND;

  invalidateRoundsAddedOrRemoved(deleted);
  return { ok: true };
}

/**
 * Inserts a Round for each user on the event's course and date and its
 * starting tee. Users who already have a Round in the event are skipped.
 */
export async function insertEventRounds(
  tx: Transaction,
  event: EventRef,
  userIds: string[],
): Promise<ChangedRound[]> {
  if (userIds.length === 0) return [];

  const values = await readEventRoundValues(tx, event);
  if (!values) throw new Error("Event not found.");

  return tx
    .insert(rounds)
    .values(userIds.map((userId) => ({ ...values, userId })))
    .onConflictDoNothing()
    .returning(changedRoundColumns);
}

export async function deleteEventRounds(
  tx: Transaction,
  event: { matchId: number },
): Promise<ChangedRound[]> {
  return tx
    .delete(rounds)
    .where(eq(rounds.matchId, event.matchId))
    .returning(changedRoundColumns);
}

async function readEventRoundValues(tx: Transaction, event: EventRef) {
  if ("tournamentId" in event) {
    const [tournament] = await tx
      .select({
        courseId: tournaments.courseId,
        teeId: tournaments.teeId,
        date: tournaments.date,
      })
      .from(tournaments)
      .where(eq(tournaments.id, event.tournamentId))
      .limit(1);
    return tournament
      ? { ...tournament, tournamentId: event.tournamentId }
      : null;
  }

  const [match] = await tx
    .select({ courseId: matches.courseId, date: matches.date })
    .from(matches)
    .where(eq(matches.id, event.matchId))
    .limit(1);
  return match
    ? { ...match, teeId: event.teeId, matchId: event.matchId }
    : null;
}

/** The "Round changed" refresh plus the home events cache for event Rounds. */
export function invalidateRoundsAddedOrRemoved(changed: ChangedRound[]) {
  // Event Rounds appear in the home page's event list (ADR 0005).
  if (changed.some((r) => r.tournamentId != null || r.matchId != null)) {
    invalidateHomeEventsCache();
  }
  invalidateRoundChanged(changed);
}

// The fixed "Round changed" page set. The home events cache is left to Round
// creation and deletion: the home page shows no scores, and invalidating it on
// every hole entry would wake the database for anonymous traffic (ADR 0005).
export function invalidateRoundChanged(changed: ChangedRound[]) {
  const paths = new Set<string>();
  for (const round of changed) {
    paths.add(`/players/${round.userId}`);
    paths.add(`/rounds/${round.id}`);
    if (round.tournamentId != null) {
      paths.add(`/tournaments/${round.tournamentId}`);
    }
    if (round.matchId != null) paths.add(`/matches/${round.matchId}`);
  }

  revalidatePath("/");
  revalidatePath("/records");
  revalidatePath("/clubs/[handle]", "page");
  for (const path of paths) revalidatePath(path);
}
