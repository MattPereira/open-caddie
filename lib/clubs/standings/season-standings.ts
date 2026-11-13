import { comparePlayers } from "@/lib/players/player-name";
import { rankPutts, rankStrokes } from "@/lib/tournaments/results";

import type { PointRules } from "./point-rules";

export type StandingPlayer = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  image: string | null;
};

export type RoundPoints = Record<PointCategory, number> & { total: number };

export type SeasonStandingsTournamentInput = {
  id: number;
  date: Date;
  season: number;
  courseId: number;
  courseHandle: string;
  courseName: string;
};

export type SeasonStandingsRoundInput = {
  roundId: number;
  tournamentId: number;
  playerId: string;
  player: StandingPlayer;
  date: Date;
  courseId: number;
  courseHandle: string;
  courseName: string;
  totalStrokes: number;
  totalPutts: number;
  recordedPuttsCount: number;
  isComplete: boolean;
  playerIndex: number | null;
  courseHandicap: number;
  netStrokes: number | null;
  scores: Array<{ hole: number; par: number | null; strokes: number | null }>;
  greenies: Array<{ feet: number; inches: number }>;
};

export type StandingsRound = SeasonStandingsRoundInput & { points: RoundPoints };

export type PlayerStanding = {
  position: number;
  playerId: string;
  player: StandingPlayer;
  roundsPlayed: number;
  countedRounds: number;
  droppedRounds: number;
  points: RoundPoints;
  roundBreakdown: Array<StandingsRound & { counted: boolean }>;
};

export type ComputedSeasonStandings = {
  tournaments: Array<SeasonStandingsTournamentInput & { rounds: StandingsRound[] }>;
  players: PlayerStanding[];
};

export function computeSeasonStandings({
  pointRules,
  countedRoundLimit,
  tournaments,
  rounds,
}: {
  pointRules: PointRules;
  countedRoundLimit: number;
  tournaments: SeasonStandingsTournamentInput[];
  rounds: SeasonStandingsRoundInput[];
}): ComputedSeasonStandings {
  const roundsByTournamentId = Map.groupBy(rounds, (round) => round.tournamentId);

  const standingsTournaments = tournaments.map((tournament) => {
    const tournamentRounds = (roundsByTournamentId.get(tournament.id) ?? [])
      .map(withSortablePlayer)
      .sort(comparePlayers);
    const strokePoints = positionPoints(
      rankStrokes(tournamentRounds),
      pointRules.strokes.positions,
    );
    const puttPoints = positionPoints(
      rankPutts(tournamentRounds),
      pointRules.putts.positions,
    );

    return {
      ...tournament,
      rounds: tournamentRounds
        .map(({ round }) => ({
          ...round,
          points: roundPoints(round, pointRules, {
            strokes: strokePoints.get(round.roundId) ?? 0,
            putts: puttPoints.get(round.roundId) ?? 0,
          }),
        }))
        .sort(compareRoundPointStandings),
    };
  });

  return {
    tournaments: standingsTournaments,
    players: playerStandings(
      standingsTournaments.flatMap((tournament) => tournament.rounds),
      countedRoundLimit,
    ),
  };
}

type PointCategory =
  | "participation"
  | "strokes"
  | "putts"
  | "greenies"
  | "pars"
  | "birdies"
  | "eagles"
  | "aces";

const pointCategories: PointCategory[] = [
  "participation",
  "strokes",
  "putts",
  "greenies",
  "pars",
  "birdies",
  "eagles",
  "aces",
];

// Tournament Ranking compares the Player's name fields at the top level.
function withSortablePlayer(round: SeasonStandingsRoundInput) {
  return {
    round,
    playerId: round.playerId,
    firstName: round.player.firstName,
    lastName: round.player.lastName,
    username: round.player.username,
    isComplete: round.isComplete,
    netStrokes: round.netStrokes,
    totalStrokes: round.totalStrokes,
    totalPutts: round.totalPutts,
    recordedPuttsCount: round.recordedPuttsCount,
  };
}

function positionPoints(
  ranking: Array<{ round: { roundId: number } }>,
  pointValues: number[],
) {
  return new Map(
    ranking.map(({ round }, index) => [round.roundId, pointValues[index] ?? 0]),
  );
}

function roundPoints(
  round: SeasonStandingsRoundInput,
  pointRules: PointRules,
  positions: { strokes: number; putts: number },
): RoundPoints {
  const totals = emptyPointTotals();
  totals.participation = pointRules.participation;
  totals.strokes = positions.strokes;
  totals.putts = positions.putts;

  for (const score of round.scores) {
    const holeScore = holeScoreType(score);
    if (holeScore === "par") totals.pars += pointRules.pars;
    if (holeScore === "birdie") totals.birdies += pointRules.birdies;
    if (holeScore === "eagle") totals.eagles += pointRules.eagles;
    if (holeScore === "ace") totals.aces += pointRules.aces;
  }

  for (const greenie of round.greenies) {
    totals.greenies += greeniePoints(greenie, pointRules);
  }

  return withTotal(totals);
}

function holeScoreType({
  par,
  strokes,
}: {
  par: number | null;
  strokes: number | null;
}): "par" | "birdie" | "eagle" | "ace" | "none" {
  if (par == null || strokes == null) return "none";
  if (strokes === 1) return "ace";
  if (strokes === par) return "par";
  if (strokes === par - 1) return "birdie";
  if (strokes <= par - 2) return "eagle";
  return "none";
}

function greeniePoints(
  greenie: { feet: number; inches: number },
  pointRules: PointRules,
) {
  const distanceInches = greenie.feet * 12 + greenie.inches;

  for (const tier of pointRules.greenies.tiers) {
    if (tier.maxFt == null) return tier.pts;
    if (distanceInches <= tier.maxFt * 12) return tier.pts;
  }

  return 0;
}

function playerStandings(
  rounds: StandingsRound[],
  countedRoundLimit: number,
): PlayerStanding[] {
  return Array.from(Map.groupBy(rounds, (round) => round.playerId).entries())
    .map(([playerId, playerRounds]) => {
      const rankedRounds = [...playerRounds].sort(compareRoundPointTotals);
      const counted = rankedRounds.slice(0, countedRoundLimit);
      const countedRoundIds = new Set(counted.map((round) => round.roundId));

      return {
        position: 0,
        playerId,
        player: playerRounds[0].player,
        roundsPlayed: playerRounds.length,
        countedRounds: counted.length,
        droppedRounds: playerRounds.length - counted.length,
        points: sumRoundPoints(counted),
        roundBreakdown: rankedRounds.map((round) => ({
          ...round,
          counted: countedRoundIds.has(round.roundId),
        })),
      };
    })
    .sort(comparePlayerStandingTotals)
    .map((standing, index) => ({ ...standing, position: index + 1 }));
}

function emptyPointTotals(): Record<PointCategory, number> {
  return {
    participation: 0,
    strokes: 0,
    putts: 0,
    greenies: 0,
    pars: 0,
    birdies: 0,
    eagles: 0,
    aces: 0,
  };
}

function withTotal(totals: Record<PointCategory, number>): RoundPoints {
  const total = pointCategories.reduce((sum, category) => sum + totals[category], 0);
  return { ...totals, total };
}

function sumRoundPoints(rounds: Array<{ points: RoundPoints }>) {
  const totals = emptyPointTotals();

  for (const round of rounds) {
    for (const category of pointCategories) {
      totals[category] += round.points[category];
    }
  }

  return withTotal(totals);
}

function compareRoundPointStandings(a: StandingsRound, b: StandingsRound) {
  const pointsCompare = b.points.total - a.points.total;
  if (pointsCompare !== 0) return pointsCompare;
  return comparePlayers(
    { ...a.player, playerId: a.playerId },
    { ...b.player, playerId: b.playerId },
  );
}

function compareRoundPointTotals(a: StandingsRound, b: StandingsRound) {
  const pointsCompare = b.points.total - a.points.total;
  if (pointsCompare !== 0) return pointsCompare;
  return a.roundId - b.roundId;
}

function comparePlayerStandingTotals(a: PlayerStanding, b: PlayerStanding) {
  const pointsCompare = b.points.total - a.points.total;
  if (pointsCompare !== 0) return pointsCompare;

  const roundsCompare = b.countedRounds - a.countedRounds;
  if (roundsCompare !== 0) return roundsCompare;

  return a.playerId.localeCompare(b.playerId);
}
