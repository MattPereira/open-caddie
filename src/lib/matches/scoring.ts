import type { MatchFormat } from "@/db/schema";
import { HOLE_COUNT, HOLE_NUMBERS } from "@/modules/courses/holes";
import { matchFormatPolicy } from "./formats";

/** Already-assessed Playing Handicap and recorded scores; no reader or UI types. */
export type ScoringRound = {
  id: number;
  playerId: string;
  kind: "match" | "tournament" | "casual";
  playingHandicap: number | null;
  recordedStrokesCount: number;
  scores: { hole: number; strokes: number | null }[];
};

export type ScoringHole = { hole: number; handicap: number | null };

export type ScoringTeam = { id: number; rounds: ScoringRound[] };

/** Who a contest side is, so views can label it without re-deriving format. */
export type MatchPlaySide =
  | { kind: "team"; matchTeamId: number }
  | { kind: "player"; playerId: string };

export type ScoredMatchPlayTeam = {
  id: string;
  side: MatchPlaySide;
  roundIds: number[];
  receivedStrokes: number;
  holesWon: number;
};

export type ScoredContest = {
  teams: ScoredMatchPlayTeam[];
  holes: (MatchPlayHoleResult & {
    playerScores: {
      roundId: number;
      teamId: string;
      netScore: number | null;
      receivedStrokes: number;
      wonHole: boolean;
    }[];
  })[];
  finalStatus: MatchPlayStatus;
  holesCompleted: number;
  holesRemaining: number;
  state: "unstarted" | "in_progress" | "closed" | "complete";
};

export type MatchPlayScoringResult =
  | { status: "unavailable"; reason: "round_count" | "teams" }
  | { status: "ready"; contests: ScoredContest[] };

export function scoreMatchPlay({
  format,
  rounds,
  teams = [],
  holes,
}: {
  format: MatchFormat;
  rounds: ScoringRound[];
  teams?: ScoringTeam[];
  holes: ScoringHole[];
}): MatchPlayScoringResult {
  const policy = matchFormatPolicy(format);
  if (format === "four_ball_match_play") {
    const eligibleTeams = teams.map((team) => ({
      id: String(team.id),
      side: { kind: "team" as const, matchTeamId: team.id },
      rounds: team.rounds.filter(isMatchPlayRound),
    }));
    if (
      eligibleTeams.length !== policy.teamCount ||
      eligibleTeams.some((team) => team.rounds.length !== policy.teamSize)
    ) {
      return { status: "unavailable", reason: "teams" };
    }
    return {
      status: "ready",
      contests: [scoreContest(eligibleTeams, policy.allowance, holes)],
    };
  }

  const eligibleRounds = rounds.filter(isMatchPlayRound);
  if (eligibleRounds.length !== policy.playerCount) {
    return { status: "unavailable", reason: "round_count" };
  }
  const individualTeams = eligibleRounds.map((round) => ({
    id: round.playerId,
    side: { kind: "player" as const, playerId: round.playerId },
    rounds: [round],
  }));
  if (format === "three_ball_match_play") {
    return {
      status: "ready",
      contests: [
        scoreContest(
          [individualTeams[0], individualTeams[1]],
          policy.allowance,
          holes,
        ),
        scoreContest(
          [individualTeams[0], individualTeams[2]],
          policy.allowance,
          holes,
        ),
        scoreContest(
          [individualTeams[1], individualTeams[2]],
          policy.allowance,
          holes,
        ),
      ],
    };
  }
  return {
    status: "ready",
    contests: [scoreContest(individualTeams, policy.allowance, holes)],
  };
}

export type MatchSkinHoleResult = {
  hole: number;
  holeHandicap: number | null;
  winningRoundId: number | null;
  skinsAwarded: number;
  players: {
    roundId: number;
    netScore: number | null;
    receivedStrokes: number;
  }[];
};

export type MatchSkinsResult =
  | { status: "unavailable"; reason: "players_with_scores" }
  | {
      status: "ready";
      players: {
        id: number;
        playingHandicap: number | null;
        receivedStrokes: number;
        skinsWon: number;
      }[];
      holes: MatchSkinHoleResult[];
    };

export function scoreMatchSkins(
  rounds: ScoringRound[],
  holes: ScoringHole[],
): MatchSkinsResult {
  const eligibleRounds = rounds.filter(isMatchPlayRound);
  if (eligibleRounds.filter((round) => round.recordedStrokesCount > 0).length < 2)
    return { status: "unavailable", reason: "players_with_scores" };

  const players = eligibleRounds.map((round) => ({
    id: round.id,
    playingHandicap: round.playingHandicap,
    receivedStrokes: 0,
    skinsWon: 0,
  }));
  const playersById = new Map(players.map((player) => [player.id, player]));
  const result = evaluateMatchPlay(
    eligibleRounds.map((round) => ({
      id: round.id,
      players: [toPlayer(round, holes)],
    })),
  );
  const holeResults: MatchSkinHoleResult[] = [];
  let pendingSkins = 1;

  for (const hole of result.holes) {
    const isCompleteHole = hole.teams.every((team) => team.netScore != null);
    const winningPlayer =
      hole.winningTeamId == null
        ? undefined
        : playersById.get(Number(hole.winningTeamId));
    holeResults.push({
      hole: hole.hole,
      holeHandicap: hole.holeHandicap,
      winningRoundId:
        hole.winningTeamId == null ? null : Number(hole.winningTeamId),
      skinsAwarded: winningPlayer == null ? 0 : pendingSkins,
      players: hole.teams.map((team) => ({
        roundId: Number(team.teamId),
        netScore: team.netScore,
        receivedStrokes: team.receivedStrokes,
      })),
    });
    for (const team of hole.teams) {
      const player = playersById.get(Number(team.teamId));
      if (player) player.receivedStrokes += team.receivedStrokes;
    }
    if (winningPlayer == null) {
      if (isCompleteHole) pendingSkins += 1;
      continue;
    }
    winningPlayer.skinsWon += pendingSkins;
    pendingSkins = 1;
  }
  return { status: "ready", players, holes: holeResults };
}

function isMatchPlayRound(round: ScoringRound) {
  return round.kind === "match";
}

function toPlayer(round: ScoringRound, holes: ScoringHole[]): MatchPlayPlayer {
  const scoresByHole = new Map(
    round.scores.map((score) => [score.hole, score]),
  );
  return {
    id: round.id,
    playingHandicap: round.playingHandicap,
    scores: holes.map((hole) => ({
      hole: hole.hole,
      handicap: hole.handicap ?? null,
      strokes: scoresByHole.get(hole.hole)?.strokes ?? null,
    })),
  };
}

function scoreContest(
  teams: { id: string; side: MatchPlaySide; rounds: ScoringRound[] }[],
  allowance: number,
  courseHoles: ScoringHole[],
): ScoredContest {
  const result = evaluateMatchPlay(
    teams.map((team) => ({
      id: team.id,
      players: team.rounds.map((round) => toPlayer(round, courseHoles)),
    })),
    { allowance },
  );
  const holes = result.holes.map((hole) => ({
    ...hole,
    playerScores: teams.flatMap((team) => {
      const teamResult = hole.teams.find(
        (candidate) => candidate.teamId === team.id,
      );
      const winningRoundId =
        hole.winningTeamId === team.id
          ? (teamResult?.players.find(
              (player) =>
                player.netScore != null &&
                player.netScore === teamResult.netScore,
            )?.playerId ?? null)
          : null;
      return team.rounds.map((round) => {
        const player = teamResult?.players.find(
          (candidate) => candidate.playerId === round.id,
        );
        return {
          roundId: round.id,
          teamId: team.id,
          netScore: player?.netScore ?? null,
          receivedStrokes: player?.receivedStrokes ?? 0,
          wonHole: round.id === winningRoundId,
        };
      });
    }),
  }));
  const holesCompleted = holes.filter((hole) =>
    hole.teams.every((team) => team.netScore != null),
  ).length;
  const holesRemaining = HOLE_COUNT - holesCompleted;
  return {
    teams: teams.map((team) => ({
      id: team.id,
      side: team.side,
      roundIds: team.rounds.map((round) => round.id),
      receivedStrokes: holes.reduce(
        (sum, hole) =>
          sum +
          (hole.teams.find((candidate) => candidate.teamId === team.id)
            ?.receivedStrokes ?? 0),
        0,
      ),
      holesWon: holes.filter((hole) => hole.winningTeamId === team.id).length,
    })),
    holes,
    finalStatus: result.finalStatus,
    holesCompleted,
    holesRemaining,
    // Preserve the current projection; freezing the first close-out is a separate fix.
    state:
      holesCompleted === 0
        ? "unstarted"
        : holesRemaining === 0
          ? "complete"
          : result.finalStatus.holesUp > holesRemaining
            ? "closed"
            : "in_progress",
  };
}

type MatchPlayPlayer = {
  id: string | number;
  playingHandicap: number | null;
  scores: {
    hole: number;
    handicap: number | null;
    strokes: number | null;
  }[];
};

type MatchPlayTeam = {
  id: string | number;
  players: MatchPlayPlayer[];
};

type MatchPlayTeamHoleResult = {
  teamId: MatchPlayTeam["id"];
  grossScore: number | null;
  receivedStrokes: number;
  netScore: number | null;
  players: MatchPlayPlayerHoleResult[];
};

type MatchPlayPlayerHoleResult = {
  playerId: MatchPlayPlayer["id"];
  grossScore: number | null;
  receivedStrokes: number;
  netScore: number | null;
};

type MatchPlayHoleResult = {
  hole: number;
  holeHandicap: number | null;
  teams: MatchPlayTeamHoleResult[];
  winningTeamId: MatchPlayTeam["id"] | null;
  status: MatchPlayStatus | null;
};

export type MatchPlayStatus = {
  leadingTeamId: MatchPlayTeam["id"] | null;
  holesUp: number;
};

type MatchPlayResult = {
  holes: MatchPlayHoleResult[];
  finalStatus: MatchPlayStatus;
};

type MatchPlayOptions = {
  allowance?: number;
};

function evaluateMatchPlay(
  teams: MatchPlayTeam[],
  { allowance = 1 }: MatchPlayOptions = {},
): MatchPlayResult {
  const playerAllowances = getPlayerAllowances(teams, allowance);
  const results: MatchPlayHoleResult[] = [];
  const teamWins = new Map<MatchPlayTeam["id"], number>();

  for (const team of teams) {
    teamWins.set(team.id, 0);
  }

  for (const hole of HOLE_NUMBERS) {
    const teamResults = teams.map((team) => {
      return getTeamHoleResult(team, hole, playerAllowances);
    });
    const winningTeamId = getWinningTeamId(teamResults);

    if (winningTeamId != null) {
      teamWins.set(winningTeamId, (teamWins.get(winningTeamId) ?? 0) + 1);
    }

    results.push({
      hole,
      holeHandicap:
        teamResults.find((result) => result.holeHandicap != null)
          ?.holeHandicap ?? null,
      teams: teamResults.map((result) => {
        return {
          teamId: result.teamId,
          grossScore: result.grossScore,
          receivedStrokes: result.receivedStrokes,
          netScore: result.netScore,
          players: result.players,
        };
      }),
      winningTeamId,
      status:
        teamResults.every((result) => result.netScore != null) &&
        teams.length === 2
          ? getStatus(teams, teamWins)
          : null,
    });
  }

  return {
    holes: results,
    finalStatus: getStatus(teams, teamWins),
  };
}

function getPlayerAllowances(teams: MatchPlayTeam[], allowance: number) {
  const players = teams.flatMap((team) => team.players);
  if (players.length === 0) return new Map<MatchPlayPlayer["id"], number>();

  const lowestHandicap = Math.min(
    ...players.map((player) => player.playingHandicap ?? 0),
  );

  return new Map(
    players.map((player) => [
      player.id,
      Math.max(
        0,
        Math.round(
          ((player.playingHandicap ?? 0) - lowestHandicap) * allowance,
        ),
      ),
    ]),
  );
}

function getTeamHoleResult(
  team: MatchPlayTeam,
  hole: number,
  playerAllowances: Map<MatchPlayPlayer["id"], number>,
) {
  const playerResults = team.players.map((player) => {
    const score = player.scores.find((candidate) => candidate.hole === hole);
    const grossScore = score?.strokes ?? null;
    const receivedStrokes = getReceivedStrokesOnHole({
      totalReceivedStrokes: playerAllowances.get(player.id) ?? 0,
      holeHandicap: score?.handicap ?? null,
    });

    return {
      playerId: player.id,
      holeHandicap: score?.handicap ?? null,
      grossScore,
      receivedStrokes,
      netScore: grossScore == null ? null : grossScore - receivedStrokes,
    };
  });
  const completeResults = playerResults.filter(
    (result): result is typeof result & { netScore: number } => {
      return result.netScore != null;
    },
  );
  const bestResult =
    completeResults.length === 0
      ? null
      : completeResults.reduce((best, result) => {
          return result.netScore < best.netScore ? result : best;
        });

  return {
    teamId: team.id,
    holeHandicap: playerResults[0]?.holeHandicap ?? null,
    grossScore: bestResult?.grossScore ?? null,
    receivedStrokes: bestResult?.receivedStrokes ?? 0,
    netScore: bestResult?.netScore ?? null,
    players: playerResults.map(
      ({ playerId, grossScore, receivedStrokes, netScore }) => ({
        playerId,
        grossScore,
        receivedStrokes,
        netScore,
      }),
    ),
  };
}

function getReceivedStrokesOnHole({
  totalReceivedStrokes,
  holeHandicap,
}: {
  totalReceivedStrokes: number;
  holeHandicap: number | null;
}) {
  if (holeHandicap == null || totalReceivedStrokes <= 0) return 0;

  return (
    Math.floor(totalReceivedStrokes / HOLE_COUNT) +
    (holeHandicap <= totalReceivedStrokes % HOLE_COUNT ? 1 : 0)
  );
}

function getWinningTeamId(results: MatchPlayTeamHoleResult[]) {
  if (results.some((result) => result.netScore == null)) return null;

  const lowestScore = Math.min(
    ...results.map((result) => result.netScore ?? 0),
  );
  const lowTeams = results.filter((result) => result.netScore === lowestScore);

  return lowTeams.length === 1 ? lowTeams[0].teamId : null;
}

function getStatus(
  teams: MatchPlayTeam[],
  wins: Map<MatchPlayTeam["id"], number>,
) {
  if (teams.length !== 2) {
    return {
      leadingTeamId: null,
      holesUp: 0,
    };
  }

  const [firstTeam, secondTeam] = teams;
  const firstTeamWins = wins.get(firstTeam.id) ?? 0;
  const secondTeamWins = wins.get(secondTeam.id) ?? 0;
  const holesUp = Math.abs(firstTeamWins - secondTeamWins);

  return {
    leadingTeamId:
      holesUp === 0
        ? null
        : firstTeamWins > secondTeamWins
          ? firstTeam.id
          : secondTeam.id,
    holesUp,
  };
}
