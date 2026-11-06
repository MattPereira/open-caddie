import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { courseHoles, greenies, roundScores } from "@/db/schema";
import { getRoundAccess, type AccessedRound } from "./access";

// The one write path for a Round's per-hole scores and Greenies. Not a
// "use server" module: it takes the session user id, so exposing it as an
// endpoint would let a client claim any user (ADR 0003).

/**
 * A change to one hole. A field left out keeps its stored value; an explicit
 * null clears it.
 */
export type HoleScoreChange = {
  roundId: number;
  hole: number;
  strokes?: number | null;
  putts?: number | null;
};

/** Sets a Greenie to `distance`, or clears it when `distance` is null. */
export type GreenieChange = {
  roundId: number;
  hole: number;
  distance: { feet: number; inches: number } | null;
};

export type ScorecardChanges = {
  scores?: HoleScoreChange[];
  greenies?: GreenieChange[];
};

export type ScorecardWriteFailure =
  | { ok: false; reason: "not_found"; error: string }
  | { ok: false; reason: "score_out_of_range"; error: string }
  | { ok: false; reason: "greenie_out_of_range"; error: string }
  | { ok: false; reason: "greenie_not_par_three"; error: string };

export type ScorecardWriteResult = { ok: true } | ScorecardWriteFailure;

const NOT_FOUND = {
  ok: false,
  reason: "not_found",
  error: "Round not found.",
} as const;
const SCORE_OUT_OF_RANGE = {
  ok: false,
  reason: "score_out_of_range",
  error: "Score is out of allowed range.",
} as const;
const GREENIE_OUT_OF_RANGE = {
  ok: false,
  reason: "greenie_out_of_range",
  error: "Greenie distance is out of allowed range.",
} as const;
const GREENIE_NOT_PAR_THREE = {
  ok: false,
  reason: "greenie_not_par_three",
  error: "Greenies can only be recorded on par 3 holes.",
} as const;

/**
 * Records strokes, putts and Greenies for one or more Rounds. The user must be
 * a Scorer of every Round touched. Everything is validated before anything is
 * written, and the write is all-or-nothing.
 */
export async function recordScorecardChanges(
  userId: string,
  changes: ScorecardChanges,
): Promise<ScorecardWriteResult> {
  const scores = changes.scores ?? [];
  const greenieChanges = changes.greenies ?? [];

  const roundIds = [
    ...new Set([
      ...scores.map((change) => change.roundId),
      ...greenieChanges.map((change) => change.roundId),
    ]),
  ];
  if (roundIds.length === 0) return { ok: true };

  const accesses = await Promise.all(
    roundIds.map((roundId) => getRoundAccess(userId, roundId)),
  );
  const touchedRounds: AccessedRound[] = [];
  for (const access of accesses) {
    if (!access?.canScore) return NOT_FOUND;
    touchedRounds.push(access.round);
  }

  if (!scores.every(isScoreInRange)) return SCORE_OUT_OF_RANGE;
  if (!greenieChanges.every(isGreenieInRange)) return GREENIE_OUT_OF_RANGE;

  const roundsById = new Map(touchedRounds.map((round) => [round.id, round]));
  const parThreesByCourse = await readParThreeHoles(
    greenieChanges
      .filter((change) => change.distance != null)
      .map((change) => roundsById.get(change.roundId)!.courseId),
  );
  const offParThree = greenieChanges.some(
    (change) =>
      change.distance != null &&
      !parThreesByCourse
        .get(roundsById.get(change.roundId)!.courseId)
        ?.has(change.hole),
  );
  if (offParThree) return GREENIE_NOT_PAR_THREE;

  await db.transaction(async (tx) => {
    for (const change of scores) {
      const set: { strokes?: number | null; putts?: number | null } = {};
      if (change.strokes !== undefined) set.strokes = change.strokes;
      if (change.putts !== undefined) set.putts = change.putts;

      const insert = tx.insert(roundScores).values({
        roundId: change.roundId,
        hole: change.hole,
        strokes: change.strokes ?? null,
        putts: change.putts ?? null,
      });
      if (Object.keys(set).length === 0) {
        await insert.onConflictDoNothing({
          target: [roundScores.roundId, roundScores.hole],
        });
      } else {
        await insert.onConflictDoUpdate({
          target: [roundScores.roundId, roundScores.hole],
          set,
        });
      }
    }

    for (const change of greenieChanges) {
      if (change.distance == null) {
        await tx
          .delete(greenies)
          .where(
            and(
              eq(greenies.roundId, change.roundId),
              eq(greenies.hole, change.hole),
            ),
          );
        continue;
      }

      // A Greenie hangs off its hole's score row, which may not exist yet.
      await tx
        .insert(roundScores)
        .values({ roundId: change.roundId, hole: change.hole })
        .onConflictDoNothing({
          target: [roundScores.roundId, roundScores.hole],
        });
      await tx
        .insert(greenies)
        .values({ roundId: change.roundId, hole: change.hole, ...change.distance })
        .onConflictDoUpdate({
          target: [greenies.roundId, greenies.hole],
          set: change.distance,
        });
    }
  });

  invalidateRoundChanged(touchedRounds);
  return { ok: true };
}

function isWholeNumberAtLeast(value: number, min: number) {
  return Number.isInteger(value) && value >= min;
}

function isHole(hole: number) {
  return Number.isInteger(hole) && hole >= 1 && hole <= 18;
}

function isScoreInRange(change: HoleScoreChange) {
  return (
    isHole(change.hole) &&
    (change.strokes == null || isWholeNumberAtLeast(change.strokes, 1)) &&
    (change.putts == null || isWholeNumberAtLeast(change.putts, 0))
  );
}

function isGreenieInRange(change: GreenieChange) {
  if (!isHole(change.hole)) return false;
  if (change.distance == null) return true;
  const { feet, inches } = change.distance;
  return (
    isWholeNumberAtLeast(feet, 0) && isWholeNumberAtLeast(inches, 0) && inches <= 11
  );
}

async function readParThreeHoles(courseIds: number[]) {
  const byCourse = new Map<number, Set<number>>();
  const unique = [...new Set(courseIds)];
  if (unique.length === 0) return byCourse;

  const rows = await db
    .select({ courseId: courseHoles.courseId, hole: courseHoles.hole })
    .from(courseHoles)
    .where(and(inArray(courseHoles.courseId, unique), eq(courseHoles.par, 3)));
  for (const row of rows) {
    const holes = byCourse.get(row.courseId) ?? new Set<number>();
    holes.add(row.hole);
    byCourse.set(row.courseId, holes);
  }
  return byCourse;
}

// The fixed "Round changed" page set. The home events cache is deliberately
// left alone: the home page shows no scores, and invalidating it on every hole
// entry would wake the database for anonymous traffic (ADR 0005).
function invalidateRoundChanged(changed: AccessedRound[]) {
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
