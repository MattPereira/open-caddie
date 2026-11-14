import { revalidatePath } from "next/cache";
import { and, eq, exists, isNotNull, not, or, sql } from "drizzle-orm";

import { db, type Transaction } from "@/db";
import {
  greenies,
  matches,
  roundScores,
  rounds,
  tournaments,
  users,
} from "@/db/schema";
import { getCourseIdByHandle, isTeeForCourse } from "@/modules/courses";
import { parseDateOnly } from "@/lib/dates";
import { invalidateHomeEventsCache } from "@/lib/home/cache";
import { pgCode } from "@/lib/pg-errors";
import { displayName } from "@/modules/players/player-name";
import {
  CANNOT_MANAGE_ROUND,
  ROUND_NOT_FOUND,
  readRoundAccess,
  type RoundManageFailure,
} from "./access";

// Owns whether a Round exists: every Round insert and delete goes through
// here. Not a "use server" module: public operations take the acting Player's id
// (ADR 0003). The event helpers expect an already-authorized caller, take a
// transaction, and return the Rounds they changed so the caller can refresh
// after commit.

/** A Round as the "Round changed" refresh needs it. */
export type ChangedRound = {
  id: number;
  playerId: string;
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

export type DeleteRoundResult = { ok: true } | RoundManageFailure;

const CANNOT_DELETE_ROUND = {
  ...CANNOT_MANAGE_ROUND,
  error: "You can't delete this Round.",
} as const;

const changedRoundColumns = {
  id: rounds.id,
  playerId: rounds.playerId,
  tournamentId: rounds.tournamentId,
  matchId: rounds.matchId,
};

/**
 * Creates the Player's own Round: casual, or joining a Tournament. A Tournament
 * Round takes the Tournament's course, tee and date; the form's are ignored.
 */
export async function createRound(
  playerId: string,
  values: CreateRoundValues,
): Promise<CreateRoundResult> {
  const { courseHandle, date, tournamentId, teeId } = values;

  let casualValues: typeof rounds.$inferInsert | null = null;
  if (tournamentId == null) {
    const courseId = await getCourseIdByHandle(courseHandle);
    if (!courseId) {
      return { ok: false, error: "Course not found." };
    }
    if (teeId == null) {
      return { ok: false, error: "Tees are required." };
    }
    if (!(await isTeeForCourse(teeId, courseId))) {
      return {
        ok: false,
        error: "Selected tees do not belong to this course.",
      };
    }
    casualValues = { playerId, courseId, teeId, date: parseDateOnly(date) };
  }

  let created: ChangedRound | null;
  try {
    created = await db.transaction(async (tx) => {
      let roundValues = casualValues;
      if (tournamentId != null) {
        const event = await readEventRoundValues(tx, { tournamentId });
        if (!event) return null;
        roundValues = { ...event, playerId };
      }
      const [row] = await tx
        .insert(rounds)
        .values(roundValues!)
        .returning(changedRoundColumns);
      return row;
    });
  } catch (e: unknown) {
    if (pgCode(e) === "23505") {
      return {
        ok: false,
        error: "You already have a round for this tournament.",
      };
    }
    throw e;
  }
  if (!created) {
    return { ok: false, error: "Tournament not found." };
  }

  invalidateRoundsAddedOrRemoved([created]);
  return { ok: true, roundId: created.id };
}

/** Only the Round's player or an admin may delete it. */
export async function deleteRound(
  playerId: string,
  roundId: number,
): Promise<DeleteRoundResult> {
  const access = await readRoundAccess(playerId, roundId);
  if (!access?.canScore) return ROUND_NOT_FOUND;
  if (!access.canManage) return CANNOT_DELETE_ROUND;

  const deleted = await db.transaction(async (tx) => {
    const [round] = await tx
      .select({ tournamentId: rounds.tournamentId, matchId: rounds.matchId })
      .from(rounds)
      .where(eq(rounds.id, roundId));
    if (!round) return [];
    // FOR SHARE waits out an edit of the event, which reads the event's Rounds
    // under its FOR UPDATE lock and must not see one vanish mid-edit.
    if (round.matchId != null) {
      await tx
        .select({ id: matches.id })
        .from(matches)
        .where(eq(matches.id, round.matchId))
        .for("share");
    } else if (round.tournamentId != null) {
      await tx
        .select({ id: tournaments.id })
        .from(tournaments)
        .where(eq(tournaments.id, round.tournamentId))
        .for("share");
    }
    return tx
      .delete(rounds)
      .where(eq(rounds.id, roundId))
      .returning(changedRoundColumns);
  });
  if (deleted.length === 0) return ROUND_NOT_FOUND;

  invalidateRoundsAddedOrRemoved(deleted);
  return { ok: true };
}

/**
 * Inserts a Round for each Player on the event's course and date and its
 * starting tee. Players who already have a Round in the event are skipped.
 */
export async function insertEventRounds(
  tx: Transaction,
  event: EventRef,
  playerIds: string[],
): Promise<ChangedRound[]> {
  if (playerIds.length === 0) return [];

  const values = await readEventRoundValues(tx, event);
  if (!values) throw new Error("Event not found.");

  return tx
    .insert(rounds)
    .values(playerIds.map((playerId) => ({ ...values, playerId })))
    .onConflictDoNothing()
    .returning(changedRoundColumns);
}

/** Thrown inside the caller's transaction so the event edit rolls back. */
export class EventCourseLockedError extends Error {}

/**
 * Brings an event's Rounds in line with the already-updated event row: a new
 * course moves every Round to the event's tee, a new date reaches every Round,
 * and a Tournament tee change moves unscored Rounds still on the old tee.
 * Throws EventCourseLockedError when the course changes and any Round has
 * scores or Greenies.
 */
export async function syncEventRounds(
  tx: Transaction,
  event: EventRef,
  previous: { courseId: number; date: Date; teeId?: number },
): Promise<ChangedRound[]> {
  const values = await readEventRoundValues(tx, event);
  if (!values) throw new Error("Event not found.");

  const inEvent =
    "tournamentId" in event
      ? eq(rounds.tournamentId, event.tournamentId)
      : eq(rounds.matchId, event.matchId);
  const changed = new Map<number, ChangedRound>();
  const record = (list: ChangedRound[]) => {
    for (const round of list) changed.set(round.id, round);
  };

  if (values.courseId !== previous.courseId) {
    // Scorecard writes hold their Rounds FOR SHARE, so this waits out any in
    // flight and holds off new ones; the guarded update then sees every
    // committed score and a refusal can't race a late one.
    const locked = await tx
      .select({ id: rounds.id })
      .from(rounds)
      .where(inEvent)
      .orderBy(rounds.id)
      .for("update");
    const moved = await tx
      .update(rounds)
      .set({ courseId: values.courseId, teeId: values.teeId })
      .where(and(inEvent, not(hasScoresOrGreenies(tx))))
      .returning(changedRoundColumns);
    if (moved.length !== locked.length) {
      const blocking = await tx
        .select({
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          username: users.username,
          image: users.image,
        })
        .from(rounds)
        .innerJoin(users, eq(users.id, rounds.playerId))
        .where(and(inEvent, hasScoresOrGreenies(tx)));
      throw new EventCourseLockedError(
        blocking.length === 0
          ? "Can't change the course: a Round already has scores or Greenies."
          : `Can't change the course: ${blocking.map(displayName).join(", ")} already ${blocking.length === 1 ? "has" : "have"} scores or Greenies.`,
      );
    }
    record(moved);
  } else if (previous.teeId != null && values.teeId !== previous.teeId) {
    record(
      await tx
        .update(rounds)
        .set({ teeId: values.teeId })
        .where(
          and(
            inEvent,
            eq(rounds.teeId, previous.teeId),
            not(hasScoresOrGreenies(tx)),
          ),
        )
        .returning(changedRoundColumns),
    );
  }

  if (values.date.getTime() !== previous.date.getTime()) {
    record(
      await tx
        .update(rounds)
        .set({ date: values.date })
        .where(inEvent)
        .returning(changedRoundColumns),
    );
  }

  return [...changed.values()];
}

function hasScoresOrGreenies(tx: Transaction) {
  return or(
    exists(
      tx
        .select({ one: sql`1` })
        .from(roundScores)
        .where(
          and(
            eq(roundScores.roundId, rounds.id),
            or(isNotNull(roundScores.strokes), isNotNull(roundScores.putts)),
          ),
        ),
    ),
    exists(
      tx
        .select({ one: sql`1` })
        .from(greenies)
        .where(eq(greenies.roundId, rounds.id)),
    ),
  )!;
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

// FOR SHARE waits out an edit of the event (which locks its row FOR UPDATE),
// so a Round added alongside one never lands on the old course, tee or date.
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
      .for("share");
    return tournament
      ? { ...tournament, tournamentId: event.tournamentId }
      : null;
  }

  const [match] = await tx
    .select({ courseId: matches.courseId, date: matches.date })
    .from(matches)
    .where(eq(matches.id, event.matchId))
    .for("share");
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
    paths.add(`/players/${round.playerId}`);
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
