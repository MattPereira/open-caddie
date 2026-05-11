import { displayName, getInitials } from "@/components/player-card";

const holes = Array.from({ length: 18 }, (_, index) => index + 1);

export type RoundScoresTableRound = {
  id: number;
  tournamentId?: number | null;
  userId?: string;
  courseName?: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  image: string | null;
  recordedStrokesCount: number;
  recordedPuttsCount: number;
  totalStrokes: number;
  totalPutts: number;
  tournamentHandicap: number | null;
  netStrokes: number | null;
  scores: {
    hole: number;
    par: number | null;
    strokes: number | null;
    putts: number | null;
  }[];
  holes?: {
    hole: number;
    par: number;
  }[];
  greenies?: {
    hole: number;
    feet: number;
    inches: number;
  }[];
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
    pars: holes.map((hole) => scoresByHole.get(hole)?.par ?? null),
    metrics: {
      strokes: toMetricValues(
        holes.map((hole) => scoresByHole.get(hole)?.strokes ?? null),
        toRecordedTotal(round.totalStrokes, round.recordedStrokesCount),
      ),
      putts: toMetricValues(
        holes.map((hole) => scoresByHole.get(hole)?.putts ?? null),
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
