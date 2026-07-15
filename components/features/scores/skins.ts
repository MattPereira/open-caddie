import type { RoundScoresTableRound } from "@/components/features/scores/round-scores";
import { evaluateMatchPlay } from "@/lib/matches";
import { displayName, getInitials } from "@/lib/players/player-name";

export type SkinsRound = RoundScoresTableRound & {
  holes: {
    hole: number;
    par: number;
    handicap: number | null;
  }[];
};

export type SkinHoleRow = {
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

export type SkinPlayerView = {
  id: number;
  name: string;
  initials: string;
  image: string | null;
  playingHandicap: number | null;
  receivedStrokes: number;
  skinsWon: number;
};

export function toSkinsView(rounds: SkinsRound[]) {
  const roundsById = new Map(rounds.map((round) => [round.id, round]));
  const playersById = new Map(
    rounds.map((round) => {
      const name = displayName({ ...round, email: null });

      return [
        round.id,
        {
          id: round.id,
          name,
          initials: getInitials({ ...round, email: null }),
          image: round.image,
          playingHandicap: round.playingHandicap,
          receivedStrokes: 0,
          skinsWon: 0,
        },
      ];
    }),
  );
  const players = rounds.map((round) => playersById.get(round.id)!);
  const result = evaluateMatchPlay(
    rounds.map((round) => ({
      id: round.id,
      players: [
        {
          id: round.id,
          playingHandicap: round.playingHandicap,
          scores: toSkinsScores(round),
        },
      ],
    })),
  );
  const holeRows: SkinHoleRow[] = [];
  let pendingSkins = 1;

  for (const hole of result.holes) {
    const isCompleteHole = hole.teams.every((team) => team.netScore != null);
    const winningRound =
      hole.winningTeamId == null
        ? null
        : roundsById.get(Number(hole.winningTeamId));

    holeRows.push({
      hole: hole.hole,
      holeHandicap: hole.holeHandicap,
      winningRoundId:
        hole.winningTeamId == null ? null : Number(hole.winningTeamId),
      skinsAwarded: winningRound == null ? 0 : pendingSkins,
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

    if (winningRound == null) {
      if (isCompleteHole) pendingSkins += 1;
      continue;
    }

    const winningPlayer = playersById.get(winningRound.id);
    if (winningPlayer) winningPlayer.skinsWon += pendingSkins;
    pendingSkins = 1;
  }

  return { players, holes: holeRows };
}

export function isEligibleSkinsRound(
  round: RoundScoresTableRound,
): round is SkinsRound {
  return (
    round.recordedStrokesCount > 0 &&
    Array.isArray(round.holes) &&
    round.holes.every((hole) => "handicap" in hole)
  );
}

function toSkinsScores(round: SkinsRound) {
  const scoresByHole = new Map(
    round.scores.map((score) => [score.hole, score]),
  );

  return round.holes.map((hole) => ({
    hole: hole.hole,
    handicap: hole.handicap ?? null,
    strokes: scoresByHole.get(hole.hole)?.strokes ?? null,
  }));
}
