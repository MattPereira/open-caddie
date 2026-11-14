import { comparePlayers, type SortablePlayer } from "@/modules/players/player-name";
import { rankPutts, rankStrokes } from "@/lib/tournaments/results";

import type { PointRules } from "../point-rules";

export type StandingPlayer = SortablePlayer & {
  email: string | null;
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

export type SeasonStandingsRoundInput = StandingPlayer & {
  id: number;
  tournamentId: number;
  date: Date;
  courseId: number;
  courseHandle: string;
  courseName: string;
  totalStrokes: number;
  totalPutts: number;
  recordedPuttsCount: number;
  isComplete: boolean;
  playerIndex: number | null;
  playingHandicap: number;
  netStrokes: number | null;
  scores: Array<{ hole: number; par: number | null; strokes: number | null }>;
  greenies: Array<{ feet: number; inches: number }>;
};

export type StandingsRound = SeasonStandingsRoundInput & { points: RoundPoints };

export type PlayerStanding = StandingPlayer & {
  position: number;
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
    const tournamentRounds = [
      ...(roundsByTournamentId.get(tournament.id) ?? []),
    ].sort(comparePlayers);
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
        .map((round) => ({
          ...round,
          points: roundPoints(round, pointRules, {
            strokes: strokePoints.get(round.id) ?? 0,
            putts: puttPoints.get(round.id) ?? 0,
          }),
        }))
        .sort((a, b) => comparePointTotals(a, b) || comparePlayers(a, b)),
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

const pointCategories = [
  "participation",
  "strokes",
  "putts",
  "greenies",
  "pars",
  "birdies",
  "eagles",
  "aces",
] as const;

type PointCategory = (typeof pointCategories)[number];

function positionPoints(
  ranking: Array<{ id: number }>,
  pointValues: number[],
) {
  return new Map(
    ranking.map((round, index) => [round.id, pointValues[index] ?? 0]),
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
    const category = holeScoreCategory(score);
    if (category) totals[category] += pointRules[category];
  }

  for (const greenie of round.greenies) {
    totals.greenies += greeniePoints(greenie, pointRules);
  }

  return withTotal(totals);
}

function holeScoreCategory({
  par,
  strokes,
}: {
  par: number | null;
  strokes: number | null;
}): "pars" | "birdies" | "eagles" | "aces" | null {
  if (par == null || strokes == null) return null;
  if (strokes === 1) return "aces";
  if (strokes === par) return "pars";
  if (strokes === par - 1) return "birdies";
  if (strokes <= par - 2) return "eagles";
  return null;
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
  return Array.from(Map.groupBy(rounds, (round) => round.playerId).values())
    .map((playerRounds) => {
      const rankedRounds = [...playerRounds].sort(
        (a, b) => comparePointTotals(a, b) || a.id - b.id,
      );
      const counted = rankedRounds.slice(0, countedRoundLimit);
      const countedRoundIds = new Set(counted.map((round) => round.id));
      const { playerId, email, firstName, lastName, username, image } =
        playerRounds[0];

      return {
        position: 0,
        playerId,
        email,
        firstName,
        lastName,
        username,
        image,
        roundsPlayed: playerRounds.length,
        countedRounds: counted.length,
        droppedRounds: playerRounds.length - counted.length,
        points: sumRoundPoints(counted),
        roundBreakdown: rankedRounds.map((round) => ({
          ...round,
          counted: countedRoundIds.has(round.id),
        })),
      };
    })
    .sort(
      (a, b) =>
        comparePointTotals(a, b) ||
        b.countedRounds - a.countedRounds ||
        a.playerId.localeCompare(b.playerId),
    )
    .map((standing, index) => ({ ...standing, position: index + 1 }));
}

function emptyPointTotals() {
  return Object.fromEntries(
    pointCategories.map((category) => [category, 0]),
  ) as Record<PointCategory, number>;
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

function comparePointTotals(
  a: { points: RoundPoints },
  b: { points: RoundPoints },
) {
  return b.points.total - a.points.total;
}
