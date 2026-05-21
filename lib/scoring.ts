const defaultPlayerIndexRoundLimit = 4;
const defaultPlayerIndexDifferentialsUsed = 2;
const standardSlopeRating = 113;

type PlayerIndexOptions = {
  roundLimit?: number;
  differentialsUsed?: number;
};

export function calculatePlayerIndex(
  scoreDifferentials: number[],
  {
    roundLimit = defaultPlayerIndexRoundLimit,
    differentialsUsed = defaultPlayerIndexDifferentialsUsed,
  }: PlayerIndexOptions = {},
) {
  if (scoreDifferentials.length < differentialsUsed) return null;

  const eligibleDifferentials = scoreDifferentials
    .slice(0, roundLimit)
    .sort((a, b) => a - b)
    .slice(0, differentialsUsed);

  if (eligibleDifferentials.length < differentialsUsed) return null;

  return (
    eligibleDifferentials.reduce((total, differential) => {
      return total + differential;
    }, 0) / differentialsUsed
  );
}

export function calculateCourseHandicap(
  playerIndex: number | null,
  courseSlope: number,
) {
  if (playerIndex == null) return 0;
  return (playerIndex * courseSlope) / standardSlopeRating;
}

export function calculateNetStrokes(
  totalStrokes: number | null,
  playingHandicap: number,
) {
  if (totalStrokes == null) return null;
  return totalStrokes - playingHandicap;
}
