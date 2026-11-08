import type { RoundScoresTableRound } from "@/components/features/scores/round-scores-card";
import { calculateNetStrokes } from "@/lib/handicap";
import { HOLE_NUMBERS, isComplete } from "@/lib/rounds/completeness";

import type { MatchScoreboard, ScorableRound } from "./round-play";

// Converts server Round snapshots into per-hole score entries for the live
// scorecard, and projects those entries back onto Rounds so the score grid and
// both scoreboards show the same live values. Greenies are not projected: no
// scoreboard reads them.

export type ScoreEntry = {
  hole: number;
  par: number | null;
  yards: number | null;
  strokes: number | null;
  putts: number | null;
};

export type ScoresByRoundId = Record<number, ScoreEntry[]>;

type Hole = { hole: number; par: number; yards: number | null };

// Every scorable Round is included, selected or not, so deselecting a column
// never interrupts refresh reconciliation and mates stay live on scoreboards.
export function buildScoreBase(
  round: RoundScoresTableRound,
  scorableRounds: Pick<ScorableRound, "roundId" | "scores">[],
  holes: Hole[],
): ScoresByRoundId {
  const base: ScoresByRoundId = {
    [round.id]: toScoreEntries(round.scores, holes),
  };
  for (const scorable of scorableRounds) {
    base[scorable.roundId] = toScoreEntries(scorable.scores, holes);
  }
  return base;
}

export function projectLiveRounds({
  round,
  leaderboardRounds,
  matchScoreboard,
  scoresByRoundId,
}: {
  round: RoundScoresTableRound;
  leaderboardRounds: RoundScoresTableRound[] | undefined;
  matchScoreboard: MatchScoreboard | null;
  scoresByRoundId: ScoresByRoundId;
}) {
  const project = (target: RoundScoresTableRound) => {
    const scores = scoresByRoundId[target.id];
    return scores ? projectLiveRound(target, scores) : target;
  };

  return {
    round: project(round),
    leaderboardRounds: leaderboardRounds?.map(project),
    matchScoreboard: matchScoreboard && projectMatchScoreboard(matchScoreboard, project),
  };
}

function toScoreEntries(
  roundScores: RoundScoresTableRound["scores"],
  holes: Hole[],
): ScoreEntry[] {
  const scoreByHole = new Map(roundScores.map((s) => [s.hole, s]));
  const holeByNumber = new Map(holes.map((h) => [h.hole, h]));
  return HOLE_NUMBERS.map((hole) => {
    const existing = scoreByHole.get(hole);
    const courseHole = holeByNumber.get(hole);
    return {
      hole,
      par: existing?.par ?? courseHole?.par ?? null,
      yards: courseHole?.yards ?? null,
      strokes: existing?.strokes ?? null,
      putts: existing?.putts ?? null,
    };
  });
}

// Totals mirror the round_summaries view: sums over recorded holes.
function projectLiveRound(
  round: RoundScoresTableRound,
  scores: ScoreEntry[],
): RoundScoresTableRound {
  const totalStrokes = scores.reduce((s, x) => s + (x.strokes ?? 0), 0);
  const totalPutts = scores.reduce((s, x) => s + (x.putts ?? 0), 0);
  const recordedStrokesCount = scores.filter((s) => s.strokes != null).length;
  const recordedPuttsCount = scores.filter((s) => s.putts != null).length;

  return {
    ...round,
    totalStrokes,
    totalPutts,
    recordedStrokesCount,
    recordedPuttsCount,
    netStrokes: calculateNetStrokes({
      totalStrokes,
      isComplete: isComplete({ recordedStrokesCount }),
      playingHandicap: round.playingHandicap,
    }),
    scores: scores.map(({ hole, par, strokes, putts }) => ({
      hole,
      par,
      strokes,
      putts,
    })),
  };
}

function projectMatchScoreboard(
  scoreboard: MatchScoreboard,
  project: (round: RoundScoresTableRound) => RoundScoresTableRound,
): MatchScoreboard {
  const rounds = scoreboard.rounds.map(project);
  const roundsById = new Map(rounds.map((r) => [r.id, r]));
  return {
    ...scoreboard,
    rounds,
    teams: scoreboard.teams.map((team) => ({
      ...team,
      rounds: team.rounds.map((r) => roundsById.get(r.id) ?? project(r)),
    })),
  };
}
