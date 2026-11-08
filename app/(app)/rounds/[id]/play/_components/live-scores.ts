import type { MatchFormat } from "@/app/(app)/matches/schema";
import { calculateNetStrokes } from "@/lib/handicap";
import type { CourseHole, DisplayRound } from "@/lib/rounds/reads";

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

/** What the projection reads and rewrites of a Round. */
export type LiveRound = Pick<
  DisplayRound,
  | "id"
  | "playingHandicap"
  | "totalStrokes"
  | "totalPutts"
  | "recordedStrokesCount"
  | "recordedPuttsCount"
  | "netStrokes"
> & {
  scores: Pick<
    DisplayRound["scores"][number],
    "hole" | "par" | "strokes" | "putts"
  >[];
};

export type MatchScoreboard<R extends LiveRound> = {
  format: MatchFormat;
  rounds: R[];
  teams: { id: number; name: string; rounds: R[] }[];
};

type ScoredRound = Pick<LiveRound, "id" | "scores"> &
  Pick<DisplayRound, "yards">;

export const HOLE_NUMBERS = Array.from({ length: 18 }, (_, i) => i + 1);

// Pass this Round and every Round the Scorer may score, selected or not, so
// deselecting a column never interrupts refresh reconciliation and mates stay
// live on scoreboards.
export function buildScoreBase(
  rounds: ScoredRound[],
  holes: Pick<CourseHole, "hole" | "par">[],
): ScoresByRoundId {
  const base: ScoresByRoundId = {};
  for (const round of rounds) {
    base[round.id] = toScoreEntries(round, holes);
  }
  return base;
}

export function projectLiveRounds<R extends LiveRound>({
  round,
  leaderboardRounds,
  matchScoreboard,
  scoresByRoundId,
}: {
  round: R;
  leaderboardRounds: R[] | undefined;
  matchScoreboard: MatchScoreboard<R> | null;
  scoresByRoundId: ScoresByRoundId;
}) {
  const project = (target: R) => {
    const scores = scoresByRoundId[target.id];
    return scores ? projectLiveRound(target, scores) : target;
  };

  return {
    round: project(round),
    leaderboardRounds: leaderboardRounds?.map(project),
    matchScoreboard: matchScoreboard && projectMatchScoreboard(matchScoreboard, project),
  };
}

export function isRoundComplete(
  round: Pick<LiveRound, "recordedStrokesCount" | "recordedPuttsCount">,
) {
  return (
    round.recordedStrokesCount === HOLE_NUMBERS.length &&
    round.recordedPuttsCount === HOLE_NUMBERS.length
  );
}

function toScoreEntries(
  round: ScoredRound,
  holes: Pick<CourseHole, "hole" | "par">[],
): ScoreEntry[] {
  const scoreByHole = new Map(round.scores.map((s) => [s.hole, s]));
  const parByHole = new Map(holes.map((h) => [h.hole, h.par]));
  const yardsByHole = new Map(round.yards.map((y) => [y.hole, y.yards]));
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

// Totals mirror the round_summaries view: sums over recorded holes.
function projectLiveRound<R extends LiveRound>(
  round: R,
  scores: ScoreEntry[],
): R {
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
      isComplete: recordedStrokesCount === HOLE_NUMBERS.length,
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

function projectMatchScoreboard<R extends LiveRound>(
  scoreboard: MatchScoreboard<R>,
  project: (round: R) => R,
): MatchScoreboard<R> {
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
