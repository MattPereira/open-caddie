const standardSlopeRating = 113;

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
