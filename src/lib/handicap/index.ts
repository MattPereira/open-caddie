const standardSlopeRating = 113;

function calculateCourseHandicap(playerIndex: number | null, courseSlope: number) {
  if (playerIndex == null) return 0;
  return (playerIndex * courseSlope) / standardSlopeRating;
}

export function calculateNetStrokes({
  totalStrokes,
  isComplete,
  playingHandicap,
}: {
  totalStrokes: number | null;
  isComplete: boolean;
  playingHandicap: number | null;
}) {
  if (!isComplete || totalStrokes == null || playingHandicap == null) return null;
  return totalStrokes - playingHandicap;
}

/**
 * How many of the most recent prior Rounds are eligible for a Player Index.
 * Exported so queries can cap their fetch; the module still windows whatever
 * it receives.
 */
export const PLAYER_INDEX_ROUND_LIMIT = 4;
const playerIndexDifferentialsUsed = 2;

export type PriorHandicapRound = {
  id: number;
  date: Date;
  scoreDifferential: number;
};

function compareMostRecent(a: PriorHandicapRound, b: PriorHandicapRound) {
  const dateCompare = b.date.getTime() - a.date.getTime();
  if (dateCompare !== 0) return dateCompare;
  return b.id - a.id;
}

/**
 * Select the prior Rounds feeding the Player Index: the best 2 of the last 4.
 * Empty when there are too few to compute one.
 */
function selectPlayerIndexRounds(
  priorRounds: PriorHandicapRound[],
): PriorHandicapRound[] {
  const selected = [...priorRounds]
    .sort(compareMostRecent)
    .slice(0, PLAYER_INDEX_ROUND_LIMIT)
    .sort((a, b) => a.scoreDifferential - b.scoreDifferential)
    .slice(0, playerIndexDifferentialsUsed);

  return selected.length < playerIndexDifferentialsUsed ? [] : selected;
}

function averageDifferential(rounds: PriorHandicapRound[]): number | null {
  if (rounds.length === 0) return null;
  return (
    rounds.reduce((total, round) => total + round.scoreDifferential, 0) /
    rounds.length
  );
}

/**
 * A Round's handicap inputs, by its event. The event decides the Playing
 * Handicap: a Tournament Round's is computed from prior Rounds, a Match
 * Round's comes from its Player Index Override, and a casual Round has none.
 */
export type HandicapSource =
  | { kind: "tournament"; priorRounds: PriorHandicapRound[] }
  | { kind: "match"; playerIndexOverride: number | null }
  | { kind: "casual" };

export type AssessHandicapInput = {
  source: HandicapSource;
  slope: number;
  totalStrokes: number | null;
  isComplete: boolean;
};

export type HandicapAssessment = {
  playerIndex: number | null;
  courseHandicap: number | null;
  playingHandicap: number | null;
  netStrokes: number | null;
  usedPriorRoundIds: number[];
};

type EventHandicapAssessment = HandicapAssessment & {
  courseHandicap: number;
  playingHandicap: number;
};

type MatchHandicapAssessment = EventHandicapAssessment & { playerIndex: number };

type EventSource = Exclude<HandicapSource, { kind: "casual" }>;

/**
 * Derive a Round's handicap from already-gathered inputs. Pure — it never
 * touches the database. Resolve a Player Index -> scale to a Course Handicap
 * -> apply it as the Playing Handicap -> subtract for net strokes (null when
 * the round is incomplete).
 */
export function assessHandicap(
  input: AssessHandicapInput & { source: { kind: "match" } },
): MatchHandicapAssessment;
export function assessHandicap(
  input: AssessHandicapInput & { source: EventSource },
): EventHandicapAssessment;
export function assessHandicap(input: AssessHandicapInput): HandicapAssessment;
export function assessHandicap({
  source,
  slope,
  totalStrokes,
  isComplete,
}: AssessHandicapInput): HandicapAssessment {
  if (source.kind === "casual") {
    return {
      playerIndex: null,
      courseHandicap: null,
      playingHandicap: null,
      netStrokes: null,
      usedPriorRoundIds: [],
    };
  }

  let playerIndex: number | null;
  let usedPriorRoundIds: number[];

  if (source.kind === "match") {
    // No override means the Match Round plays scratch.
    playerIndex = source.playerIndexOverride ?? 0;
    usedPriorRoundIds = [];
  } else {
    const used = selectPlayerIndexRounds(source.priorRounds);
    playerIndex = averageDifferential(used);
    usedPriorRoundIds = used.map((round) => round.id);
  }

  // A null Player Index (too few prior Rounds) scales to scratch.
  const courseHandicap = calculateCourseHandicap(playerIndex, slope);
  const playingHandicap = courseHandicap;

  return {
    playerIndex,
    courseHandicap,
    playingHandicap,
    netStrokes: calculateNetStrokes({ totalStrokes, isComplete, playingHandicap }),
    usedPriorRoundIds,
  };
}
