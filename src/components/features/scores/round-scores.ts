import { displayName, getInitials } from "@/modules/players/player-name";
import type {
  DisplayRound,
  RoundHoleGreenie,
  RoundHoleScore,
} from "@/modules/rounds";
import { HOLE_NUMBERS } from "@/modules/courses/holes";

export type RoundScoresTableRound = Pick<
  DisplayRound,
  | "id"
  | "firstName"
  | "lastName"
  | "username"
  | "image"
  | "recordedStrokesCount"
  | "recordedPuttsCount"
  | "totalStrokes"
  | "totalPutts"
  | "playingHandicap"
  | "netStrokes"
> & {
  scores: RoundHoleScore[];
  greenies: RoundHoleGreenie[];
};

export type ScoreMetric = "strokes" | "putts";

export type MetricValues = {
  scores: (number | null)[];
  out: number | null;
  in: number | null;
  total: number | null;
};

export type RoundScoreRow = {
  round: RoundScoresTableRound;
  playerName: string;
  initials: string;
  pars: (number | null)[];
  metrics: Record<ScoreMetric, MetricValues>;
};

export function toRoundScoreRow(round: RoundScoresTableRound): RoundScoreRow {
  const scoresByHole = new Map(
    round.scores.map((score) => [score.hole, score]),
  );
  const player = { ...round, email: null };

  return {
    round,
    playerName: displayName(player),
    initials: getInitials(player),
    pars: HOLE_NUMBERS.map((hole) => scoresByHole.get(hole)?.par ?? null),
    metrics: {
      strokes: toMetricValues(
        HOLE_NUMBERS.map((hole) => scoresByHole.get(hole)?.strokes ?? null),
        toRecordedTotal(round.totalStrokes, round.recordedStrokesCount),
      ),
      putts: toMetricValues(
        HOLE_NUMBERS.map((hole) => scoresByHole.get(hole)?.putts ?? null),
        toRecordedTotal(round.totalPutts, round.recordedPuttsCount),
      ),
    },
  };
}

function toMetricValues(
  scores: (number | null)[],
  total: number | null,
): MetricValues {
  return {
    scores,
    out: sumScores(scores.slice(0, 9)),
    in: sumScores(scores.slice(9)),
    total,
  };
}

function sumScores(scores: (number | null)[]) {
  const recordedScores = scores.filter((score) => score != null);
  if (recordedScores.length === 0) return null;
  return recordedScores.reduce((total, score) => total + score, 0);
}

function toRecordedTotal(total: number, recordedCount: number) {
  return recordedCount === 0 ? null : total;
}
