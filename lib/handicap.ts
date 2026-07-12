import { calculateCourseHandicap, calculateNetStrokes } from "@/lib/scoring";

const defaultPlayerIndexRoundLimit = 4;
const defaultPlayerIndexDifferentialsUsed = 2;

type PlayerIndexOptions = {
  roundLimit?: number;
  differentialsUsed?: number;
};

/**
 * Select which prior Score Differentials feed the Player Index, returning their
 * indexes into the input array. Owns the "best 2 of the last 4" rule so callers
 * never re-derive it.
 */
function selectPlayerIndexDifferentials(
  scoreDifferentials: number[],
  {
    roundLimit = defaultPlayerIndexRoundLimit,
    differentialsUsed = defaultPlayerIndexDifferentialsUsed,
  }: PlayerIndexOptions = {},
): number[] {
  if (scoreDifferentials.length < differentialsUsed) return [];

  const eligible = scoreDifferentials
    .map((value, index) => ({ value, index }))
    .slice(0, roundLimit)
    .sort((a, b) => a.value - b.value)
    .slice(0, differentialsUsed);

  if (eligible.length < differentialsUsed) return [];

  return eligible.map((entry) => entry.index);
}

/**
 * Average the selected Score Differentials into a Player Index, or null when
 * there are too few to compute one.
 */
function calculatePlayerIndex(
  scoreDifferentials: number[],
  usedIndexes: number[],
): number | null {
  if (usedIndexes.length === 0) return null;

  return (
    usedIndexes.reduce((total, index) => total + scoreDifferentials[index], 0) /
    usedIndexes.length
  );
}

/**
 * Where a round's handicap comes from: a hand-entered Player Index Override, or
 * one computed from prior Score Differentials.
 */
export type HandicapSource =
  | { kind: "override"; playerIndex: number }
  | { kind: "computed"; priorDifferentials: number[] };

export type AssessHandicapInput = {
  source: HandicapSource;
  slope: number;
  totalStrokes: number | null;
  isComplete: boolean;
};

export type HandicapAssessment = {
  playerIndex: number | null;
  courseHandicap: number;
  netStrokes: number | null;
  usedDifferentialIndexes: number[];
};

/**
 * Derive a round's handicap from already-gathered inputs. Pure — it never
 * touches the database. Both sources flow through one pipeline: resolve a
 * Player Index -> scale to a Course Handicap -> subtract for net strokes (null
 * when the round is incomplete).
 */
export function assessHandicap({
  source,
  slope,
  totalStrokes,
  isComplete,
}: AssessHandicapInput): HandicapAssessment {
  let playerIndex: number | null;
  let usedDifferentialIndexes: number[];

  if (source.kind === "override") {
    playerIndex = source.playerIndex;
    usedDifferentialIndexes = [];
  } else {
    usedDifferentialIndexes = selectPlayerIndexDifferentials(
      source.priorDifferentials,
    );
    playerIndex = calculatePlayerIndex(
      source.priorDifferentials,
      usedDifferentialIndexes,
    );
  }

  const courseHandicap = calculateCourseHandicap(playerIndex, slope);
  const netStrokes = calculateNetStrokes(
    isComplete ? totalStrokes : null,
    courseHandicap,
  );

  return { playerIndex, courseHandicap, netStrokes, usedDifferentialIndexes };
}
