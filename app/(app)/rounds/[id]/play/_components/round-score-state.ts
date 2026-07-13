import type { RoundScoresTableRound } from "@/components/features/scores/round-scores-card";
import { calculateNetStrokes } from "@/lib/handicap";

export type ScoreEntry = {
  hole: number;
  par: number | null;
  yards: number | null;
  strokes: number | null;
  putts: number | null;
};

export const HOLE_NUMBERS = Array.from({ length: 18 }, (_, i) => i + 1);

export function buildInitialScores(
  roundScores: RoundScoresTableRound["scores"],
  holes: { hole: number; par: number; yards: number | null }[],
): ScoreEntry[] {
  const scoreByHole = new Map(roundScores.map((s) => [s.hole, s]));
  const parByHole = new Map(holes.map((h) => [h.hole, h.par]));
  const yardsByHole = new Map(holes.map((h) => [h.hole, h.yards]));
  return HOLE_NUMBERS.map((hole) => {
    const existing = scoreByHole.get(hole);
    return {
      hole,
      par: existing?.par ?? parByHole.get(hole) ?? null,
      yards: yardsByHole.get(hole) ?? null,
      strokes: existing?.strokes ?? null,
      putts: existing?.putts ?? null,
    };
  });
}

export function buildLiveRound(
  round: RoundScoresTableRound,
  scores: ScoreEntry[],
): RoundScoresTableRound {
  const totalStrokes = scores.reduce((s, x) => s + (x.strokes ?? 0), 0);
  const totalPutts = scores.reduce((s, x) => s + (x.putts ?? 0), 0);
  const recordedStrokesCount = scores.filter((s) => s.strokes != null).length;
  const recordedPuttsCount = scores.filter((s) => s.putts != null).length;
  const completeTotalStrokes =
    recordedStrokesCount === HOLE_NUMBERS.length ? totalStrokes : null;

  return {
    ...round,
    totalStrokes,
    totalPutts,
    recordedStrokesCount,
    recordedPuttsCount,
    netStrokes:
      round.playingHandicap == null
        ? null
        : calculateNetStrokes(completeTotalStrokes, round.playingHandicap),
    scores: scores.map(({ hole, par, strokes, putts }) => ({
      hole,
      par,
      strokes,
      putts,
    })),
  };
}

export function isRoundComplete(round: RoundScoresTableRound) {
  return (
    round.recordedStrokesCount === HOLE_NUMBERS.length &&
    round.recordedPuttsCount === HOLE_NUMBERS.length
  );
}
