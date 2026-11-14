import { comparePlayers, type SortablePlayer } from "@/modules/players/player-name";

export type ScoredRound = SortablePlayer & {
  netStrokes: number | null;
  totalStrokes: number;
};

/**
 * Rounds without net strokes last (by player), then net, then gross, then
 * player. Round reads return this order; Tournament Ranking builds on it.
 */
export function compareRoundsByScore(a: ScoredRound, b: ScoredRound) {
  if (a.netStrokes == null && b.netStrokes == null) return comparePlayers(a, b);
  return (
    compareNullableNumbers(a.netStrokes, b.netStrokes) ||
    a.totalStrokes - b.totalStrokes ||
    comparePlayers(a, b)
  );
}

export function compareNullableNumbers(a: number | null, b: number | null) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}
