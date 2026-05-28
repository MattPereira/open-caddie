import type { MatchFormat } from "@/db/schema";

const FORMAT_LABELS: Record<MatchFormat, string> = {
  singles_match_play: "Head-to-Head",
  three_ball_match_play: "Three-Ball",
  four_ball_match_play: "Four-Ball",
};

export function matchFormatLabel(format: MatchFormat | null | undefined) {
  return format ? FORMAT_LABELS[format] : null;
}

const holes = Array.from({ length: 18 }, (_, index) => index + 1);

export type MatchPlayPlayer = {
  id: string | number;
  playingHandicap: number | null;
  scores: {
    hole: number;
    handicap: number | null;
    strokes: number | null;
  }[];
};

export type MatchPlayTeam = {
  id: string | number;
  players: MatchPlayPlayer[];
};

export type MatchPlayTeamHoleResult = {
  teamId: MatchPlayTeam["id"];
  grossScore: number | null;
  receivedStrokes: number;
  netScore: number | null;
};

export type MatchPlayHoleResult = {
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

export type MatchPlayResult = {
  holes: MatchPlayHoleResult[];
  finalStatus: MatchPlayStatus;
};

export type MatchPlayOptions = {
  allowance?: number;
};

export function evaluateMatchPlay(
  teams: MatchPlayTeam[],
  { allowance = 1 }: MatchPlayOptions = {},
): MatchPlayResult {
  const playerAllowances = getPlayerAllowances(teams, allowance);
  const results: MatchPlayHoleResult[] = [];
  const teamWins = new Map<MatchPlayTeam["id"], number>();

  for (const team of teams) {
    teamWins.set(team.id, 0);
  }

  for (const hole of holes) {
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
        Math.round(((player.playingHandicap ?? 0) - lowestHandicap) * allowance),
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
    Math.floor(totalReceivedStrokes / 18) +
    (holeHandicap <= totalReceivedStrokes % 18 ? 1 : 0)
  );
}

function getWinningTeamId(results: MatchPlayTeamHoleResult[]) {
  if (results.some((result) => result.netScore == null)) return null;

  const lowestScore = Math.min(...results.map((result) => result.netScore ?? 0));
  const lowTeams = results.filter((result) => result.netScore === lowestScore);

  return lowTeams.length === 1 ? lowTeams[0].teamId : null;
}

function getStatus(teams: MatchPlayTeam[], wins: Map<MatchPlayTeam["id"], number>) {
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
