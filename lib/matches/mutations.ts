import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";

import { db, type Transaction } from "@/db";
import {
  matches,
  matchTeamMembers,
  matchTeams,
  rounds,
  users,
  type MatchFormat,
} from "@/db/schema";
import { getCourseIdByHandle, isTeeForCourse } from "@/lib/courses/tees";
import { parseDateOnly } from "@/lib/dates";
import { invalidateHomeEventsCache } from "@/lib/home/cache";
import { pgCode } from "@/lib/pg-errors";
import {
  deleteEventRounds,
  EventCourseLockedError,
  insertEventRounds,
  invalidateRoundChanged,
  syncEventRounds,
  type ChangedRound,
} from "@/lib/rounds/lifecycle";
import { isAdmin } from "@/lib/users/admin";
import { matchFormatPolicy } from "./formats";

// Match writes. Plain module: route actions authenticate and parse untrusted
// input, then pass the session user id in (ADR 0003).

export type MatchWriteResult =
  | { ok: true; id?: number }
  | { ok: false; error: string };

type MatchInput = {
  /** yyyy-mm-dd */
  date: string;
  courseHandle: string;
  format: MatchFormat;
  teeId: number;
  playerUserIds: string[];
  teamOneUserIds: string[];
  teamTwoUserIds: string[];
};

/** Player count and Four-Ball team split are already validated. */
export type MatchCreateInput = MatchInput;

/**
 * Four-Ball teams come from `teamOneRoundIds`/`teamTwoRoundIds` when the
 * Match has its 4 Rounds, or from the team user ids when the Roster is being
 * refilled.
 */
export type MatchUpdateInput = MatchInput & {
  id: number;
  teamOneRoundIds: number[];
  teamTwoRoundIds: number[];
};

const FOUR_BALL_POLICY = matchFormatPolicy("four_ball_match_play");

export async function createMatch(
  userId: string,
  values: MatchCreateInput,
): Promise<MatchWriteResult> {
  const { format, teeId, playerUserIds, teamOneUserIds, teamTwoUserIds } =
    values;
  const courseId = await getCourseIdByHandle(values.courseHandle);
  if (!courseId) {
    return { ok: false, error: "Selected course does not exist." };
  }
  if (!(await isTeeForCourse(teeId, courseId))) {
    return { ok: false, error: "Selected tee does not belong to this course." };
  }
  if (!(await playersExist(playerUserIds))) {
    return {
      ok: false,
      error: "One or more selected players no longer exist.",
    };
  }

  try {
    const created = await db.transaction(async (tx) => {
      const [match] = await tx
        .insert(matches)
        .values({
          createdByUserId: userId,
          courseId,
          date: parseDateOnly(values.date),
          format,
        })
        .returning({ id: matches.id });

      const inserted = await insertEventRounds(
        tx,
        { matchId: match.id, teeId },
        playerUserIds,
      );
      if (format === "four_ball_match_play") {
        const roundIdByUserId = new Map(inserted.map((r) => [r.userId, r.id]));
        await insertMatchTeams(
          tx,
          match.id,
          roundIdsFor([teamOneUserIds, teamTwoUserIds], roundIdByUserId),
        );
      }
      return { matchId: match.id, inserted };
    });

    invalidateRoundChanged(created.inserted);
    invalidateMatchChanged(created.matchId);
    return { ok: true, id: created.matchId };
  } catch (e: unknown) {
    if (pgCode(e) === "23503") {
      return { ok: false, error: "Selected user or course does not exist." };
    }
    throw e;
  }
}

export async function updateMatch(
  userId: string,
  values: MatchUpdateInput,
): Promise<MatchWriteResult> {
  const { id, format, teeId, playerUserIds } = values;
  const manage = await canManageMatch(userId, id);
  if (!manage.ok) return manage;

  const courseId = await getCourseIdByHandle(values.courseHandle);
  if (!courseId) {
    return { ok: false, error: "Selected course does not exist." };
  }

  // Input-only checks for a possible Four-Ball refill, kept out of the
  // transaction so the Match lock is held briefly.
  const mayRefill =
    format === "four_ball_match_play" && isFourBallRoster(values);
  if (mayRefill) {
    if (!(await isTeeForCourse(teeId, courseId))) {
      return {
        ok: false,
        error: "Selected tee does not belong to this course.",
      };
    }
    if (!(await playersExist(playerUserIds))) {
      return {
        ok: false,
        error: "One or more selected players no longer exist.",
      };
    }
  }

  const changed: ChangedRound[] = [];
  try {
    const refused = await db.transaction(async (tx) => {
      const [previous] = await tx
        .select({ courseId: matches.courseId, date: matches.date })
        .from(matches)
        .where(eq(matches.id, id))
        .for("update");
      if (!previous) return "Match not found.";

      // Read under the lock: Round inserts and deletes for this Match wait
      // on it, so the Rounds can't change before the teams are written.
      const matchRounds = await tx
        .select({ id: rounds.id, userId: rounds.userId })
        .from(rounds)
        .where(eq(rounds.matchId, id));

      let plan: FourBallPlan | null = null;
      if (format === "four_ball_match_play") {
        plan = planFourBallTeams(values, matchRounds, mayRefill);
        if (!plan) {
          return "Four-ball match play requires 4 rounds split into 2 teams.";
        }
      } else if (matchRounds.length > matchFormatPolicy(format).playerCount) {
        return format === "singles_match_play"
          ? "Singles match play requires 2 or fewer player rounds."
          : "Three-ball match play requires 3 or fewer player rounds.";
      }

      // A course change moves the Rounds onto the submitted tee.
      if (
        previous.courseId !== courseId &&
        !(await isTeeForCourse(teeId, courseId, tx))
      ) {
        return "Selected tee does not belong to this course.";
      }

      await tx
        .update(matches)
        .set({ courseId, date: parseDateOnly(values.date), format })
        .where(eq(matches.id, id));
      // Before the refill, so refilled Rounds share the existing Rounds'
      // course.
      changed.push(
        ...(await syncEventRounds(tx, { matchId: id, teeId }, previous)),
      );
      await tx.delete(matchTeams).where(eq(matchTeams.matchId, id));
      if (!plan) return null;

      let teamRoundIds: [number[], number[]];
      if ("refillUserIds" in plan) {
        const refilled = await refillFourBallRoster(
          tx,
          { matchId: id, teeId },
          matchRounds,
          plan,
        );
        changed.push(...refilled.inserted);
        teamRoundIds = refilled.teamRoundIds;
      } else {
        teamRoundIds = plan.teamRoundIds;
      }
      await insertMatchTeams(tx, id, teamRoundIds);
      return null;
    });
    if (refused) return { ok: false, error: refused };
  } catch (e: unknown) {
    if (e instanceof EventCourseLockedError) {
      return { ok: false, error: e.message };
    }
    if (pgCode(e) === "23503") {
      return { ok: false, error: "Selected course does not exist." };
    }
    throw e;
  }

  if (changed.length > 0) invalidateRoundChanged(changed);
  invalidateMatchChanged(id);
  return { ok: true };
}

export async function deleteMatch(
  userId: string,
  id: number,
): Promise<MatchWriteResult> {
  const manage = await canManageMatch(userId, id);
  if (!manage.ok) return manage;

  const deleted = await db.transaction(async (tx) => {
    const removed = await deleteEventRounds(tx, { matchId: id });
    await tx.delete(matches).where(eq(matches.id, id));
    return removed;
  });
  invalidateRoundChanged(deleted);
  invalidateMatchChanged(id);
  return { ok: true };
}

/** Only the Match's creator or an admin may change the Match itself. */
async function canManageMatch(
  userId: string,
  matchId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [match] = await db
    .select({ createdByUserId: matches.createdByUserId })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!match) return { ok: false, error: "Match not found." };
  if (match.createdByUserId !== userId && !(await isAdmin(userId))) {
    return { ok: false, error: "Only the match creator can edit this match." };
  }
  return { ok: true };
}

async function playersExist(userIds: string[]) {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, userIds));
  return existing.length === new Set(userIds).size;
}

/** 4 distinct players split 2 and 2, every team member among them. */
function isFourBallRoster(values: MatchInput) {
  const { playerUserIds, teamOneUserIds, teamTwoUserIds } = values;
  const teamUserIds = [...teamOneUserIds, ...teamTwoUserIds];
  return (
    new Set(playerUserIds).size === FOUR_BALL_POLICY.playerCount &&
    playerUserIds.length === FOUR_BALL_POLICY.playerCount &&
    teamOneUserIds.length === FOUR_BALL_POLICY.teamSize &&
    teamTwoUserIds.length === FOUR_BALL_POLICY.teamSize &&
    new Set(teamUserIds).size === FOUR_BALL_POLICY.playerCount &&
    teamUserIds.every((u) => playerUserIds.includes(u))
  );
}

type FourBallPlan =
  | { teamRoundIds: [number[], number[]] }
  | { refillUserIds: string[]; teamUserIds: [string[], string[]] };

/**
 * A Match with its 4 Rounds takes teams by Round id. One with fewer is
 * refilled from the submitted roster, which must keep every current player.
 */
function planFourBallTeams(
  values: MatchUpdateInput,
  matchRounds: { id: number; userId: string }[],
  isRoster: boolean,
): FourBallPlan | null {
  if (matchRounds.length === FOUR_BALL_POLICY.playerCount) {
    const { teamOneRoundIds, teamTwoRoundIds } = values;
    const selected = [...teamOneRoundIds, ...teamTwoRoundIds];
    const matchRoundIds = new Set(matchRounds.map((r) => r.id));
    const fits =
      teamOneRoundIds.length === FOUR_BALL_POLICY.teamSize &&
      teamTwoRoundIds.length === FOUR_BALL_POLICY.teamSize &&
      new Set(selected).size === FOUR_BALL_POLICY.playerCount &&
      selected.every((roundId) => matchRoundIds.has(roundId));
    return fits ? { teamRoundIds: [teamOneRoundIds, teamTwoRoundIds] } : null;
  }

  if (
    !isRoster ||
    !matchRounds.every((r) => values.playerUserIds.includes(r.userId))
  ) {
    return null;
  }
  const playing = new Set(matchRounds.map((r) => r.userId));
  return {
    refillUserIds: values.playerUserIds.filter((u) => !playing.has(u)),
    teamUserIds: [values.teamOneUserIds, values.teamTwoUserIds],
  };
}

/** Adds Rounds for the roster's missing players and resolves teams to Rounds. */
async function refillFourBallRoster(
  tx: Transaction,
  event: { matchId: number; teeId: number },
  matchRounds: { id: number; userId: string }[],
  plan: { refillUserIds: string[]; teamUserIds: [string[], string[]] },
) {
  const inserted = await insertEventRounds(tx, event, plan.refillUserIds);
  const roundIdByUserId = new Map(
    [...matchRounds, ...inserted].map((r) => [r.userId, r.id]),
  );
  return {
    inserted,
    teamRoundIds: roundIdsFor(plan.teamUserIds, roundIdByUserId),
  };
}

function roundIdsFor(
  teamUserIds: [string[], string[]],
  roundIdByUserId: Map<string, number>,
): [number[], number[]] {
  const [one, two] = teamUserIds.map((userIds) =>
    userIds.map((userId) => {
      const roundId = roundIdByUserId.get(userId);
      if (roundId == null) throw new Error("Failed to create match teams.");
      return roundId;
    }),
  );
  return [one, two];
}

async function insertMatchTeams(
  tx: Transaction,
  matchId: number,
  teamRoundIds: [number[], number[]],
) {
  const inserted = await tx
    .insert(matchTeams)
    .values([
      { matchId, name: "Team A", sortOrder: 0 },
      { matchId, name: "Team B", sortOrder: 1 },
    ])
    .returning({ id: matchTeams.id, sortOrder: matchTeams.sortOrder });
  const teamIdBySortOrder = new Map(inserted.map((t) => [t.sortOrder, t.id]));

  await tx.insert(matchTeamMembers).values(
    teamRoundIds.flatMap((roundIds, index) => {
      const matchTeamId = teamIdBySortOrder.get(index);
      if (matchTeamId == null) throw new Error("Failed to create match teams.");
      return roundIds.map((roundId) => ({ matchTeamId, roundId }));
    }),
  );
}

// The "Match changed" page set, separate from "Round changed". The Match's
// date, course and format show in the home page's event list.
function invalidateMatchChanged(id: number) {
  invalidateHomeEventsCache();
  revalidatePath("/matches");
  revalidatePath(`/matches/${id}`);
}
