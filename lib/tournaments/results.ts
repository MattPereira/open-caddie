import { comparePlayers, type SortablePlayer } from "@/lib/players/player-name";
import { HOLE_COUNT, HOLE_NUMBERS, hasAllPutts } from "@/lib/rounds/completeness";

type ResultsPlayer = SortablePlayer;

export type StrokesResultRound = ResultsPlayer & {
  isComplete: boolean;
  netStrokes: number | null;
  totalStrokes: number;
};

export type PuttsResultRound = StrokesResultRound & {
  totalPutts: number;
  recordedPuttsCount: number;
};

export type GreenieResult = ResultsPlayer & {
  hole: number;
  feet: number;
  inches: number;
};

export type TournamentSkinsRound = ResultsPlayer & {
  isComplete: boolean;
  playingHandicap: number;
  scores: readonly {
    hole: number;
    handicap: number | null;
    strokes: number | null;
  }[];
};

export type TournamentSkin<T extends TournamentSkinsRound> = {
  hole: number;
  round: T;
  strokes: number;
  netStrokes: number;
};

export function rankStrokes<T extends StrokesResultRound>(rounds: readonly T[]) {
  return rounds
    .filter((round) => round.isComplete && round.netStrokes != null)
    .sort(compareTournamentRanking);
}

export type RankedRound = ResultsPlayer & {
  netStrokes: number | null;
  totalStrokes: number;
};

/**
 * Tournament ranking order: Rounds without net strokes last (by player), then
 * net, then gross, then player. Every leaderboard sorts with this.
 */
export function compareTournamentRanking(a: RankedRound, b: RankedRound) {
  if (a.netStrokes == null && b.netStrokes == null) return comparePlayers(a, b);
  return (
    compareNullableNumbers(a.netStrokes, b.netStrokes) ||
    a.totalStrokes - b.totalStrokes ||
    comparePlayers(a, b)
  );
}

export function rankPutts<T extends PuttsResultRound>(rounds: readonly T[]) {
  return rounds
    .filter((round) => round.isComplete && hasAllPutts(round))
    .sort(
      (a, b) =>
        a.totalPutts - b.totalPutts ||
        compareNullableNumbers(a.netStrokes, b.netStrokes) ||
        a.totalStrokes - b.totalStrokes ||
        comparePlayers(a, b),
    );
}

export function greenieWinners<T extends GreenieResult>(greenies: readonly T[]) {
  const winnersByHole = new Map<number, T>();

  for (const greenie of [...greenies].sort(compareGreenies)) {
    if (!winnersByHole.has(greenie.hole)) {
      winnersByHole.set(greenie.hole, greenie);
    }
  }

  return Array.from(winnersByHole.values());
}

// Unlike Match Skins, tied holes are dead: nothing carries forward.
export function tournamentSkins<T extends TournamentSkinsRound>(
  rounds: readonly T[],
): TournamentSkin<T>[] {
  const completeRounds = rounds.filter((round) => round.isComplete);
  const skins: TournamentSkin<T>[] = [];

  for (const hole of HOLE_NUMBERS) {
    const holeScores = completeRounds.flatMap((round) => {
      const score = round.scores.find((s) => s.hole === hole);
      if (score?.strokes == null || score.handicap == null) return [];

      return [
        {
          hole,
          round,
          strokes: score.strokes,
          netStrokes:
            score.handicap <= strokedHoleCount(round.playingHandicap)
              ? score.strokes - 1
              : score.strokes,
        },
      ];
    });

    if (holeScores.length === 0 || holeScores.length !== completeRounds.length) {
      continue;
    }

    const lowest = Math.min(...holeScores.map((score) => score.netStrokes));
    const lowScores = holeScores.filter((score) => score.netStrokes === lowest);

    if (lowScores.length === 1) skins.push(lowScores[0]);
  }

  return skins;
}

function strokedHoleCount(playingHandicap: number) {
  return Math.min(HOLE_COUNT, Math.max(0, Math.floor(playingHandicap / 2)));
}

function compareGreenies(a: GreenieResult, b: GreenieResult) {
  return (
    a.hole - b.hole ||
    a.feet * 12 + a.inches - (b.feet * 12 + b.inches) ||
    comparePlayers(a, b)
  );
}

function compareNullableNumbers(a: number | null, b: number | null) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}
