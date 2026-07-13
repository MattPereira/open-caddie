import type { PointRules } from "./point-rules";

export type PointCategory =
  | "participation"
  | "strokes"
  | "putts"
  | "greenies"
  | "pars"
  | "birdies"
  | "eagles"
  | "aces";

export type PointTotals = Record<PointCategory, number>;

export type RoundPoints = {
  participation: number;
  strokes: number;
  putts: number;
  greenies: number;
  pars: number;
  birdies: number;
  eagles: number;
  aces: number;
  total: number;
};

export type RoundScoreForPoints = {
  hole: number;
  par: number | null;
  strokes: number | null;
};

export type GreenieForPoints = {
  feet: number;
  inches: number;
};

export type PositionRound = {
  roundId: number;
};

export type PlayerRoundPoints<TUser> = {
  roundId: number;
  userId: string;
  user: TUser;
  points: RoundPoints;
};

export type PlayerStanding<TUser, TRound extends PlayerRoundPoints<TUser>> = {
  position: number;
  userId: string;
  user: TUser;
  roundsPlayed: number;
  countedRounds: number;
  droppedRounds: number;
  points: RoundPoints;
  roundBreakdown: Array<TRound & { counted: boolean }>;
};

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

export function emptyPointTotals(): PointTotals {
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

export function toRoundPoints(points: Partial<PointTotals>): RoundPoints {
  const totals = { ...emptyPointTotals(), ...points };
  return { ...totals, total: totalPoints(totals) };
}

export function sumRoundPoints(rounds: Array<{ points: RoundPoints }>) {
  const totals = emptyPointTotals();

  for (const round of rounds) {
    for (const category of pointCategories) {
      totals[category] += round.points[category];
    }
  }

  return toRoundPoints(totals);
}

export function totalPoints(points: PointTotals) {
  return pointCategories.reduce((total, category) => {
    return total + points[category];
  }, 0);
}

export function getHoleScorePoints(
  scores: RoundScoreForPoints[],
  pointRules: PointRules,
) {
  const totals = emptyPointTotals();

  for (const score of scores) {
    const holeScore = getHoleScoreType(score);

    if (holeScore === "par") totals.pars += pointRules.pars;
    if (holeScore === "birdie") totals.birdies += pointRules.birdies;
    if (holeScore === "eagle") totals.eagles += pointRules.eagles;
    if (holeScore === "ace") totals.aces += pointRules.aces;
  }

  return totals;
}

export function getHoleScoreType({
  par,
  strokes,
}: RoundScoreForPoints): "par" | "birdie" | "eagle" | "ace" | "none" {
  if (par == null || strokes == null) return "none";
  if (strokes === 1) return "ace";
  if (strokes === par) return "par";
  if (strokes === par - 1) return "birdie";
  if (strokes <= par - 2) return "eagle";
  return "none";
}

export function getGreeniePoints(
  greenies: GreenieForPoints[],
  pointRules: PointRules,
) {
  return greenies.reduce((total, greenie) => {
    return total + getSingleGreeniePoints(greenie, pointRules);
  }, 0);
}

export function getSingleGreeniePoints(
  greenie: GreenieForPoints,
  pointRules: PointRules,
) {
  const distanceInches = greenie.feet * 12 + greenie.inches;

  for (const tier of pointRules.greenies.tiers) {
    if (tier.maxFt == null) return tier.pts;
    if (distanceInches <= tier.maxFt * 12) return tier.pts;
  }

  return 0;
}

export function assignPositionPoints<T extends PositionRound>(
  rounds: T[],
  pointValues: number[],
) {
  const pointsByRoundId = new Map<number, number>();

  rounds.forEach((round, index) => {
    pointsByRoundId.set(round.roundId, pointValues[index] ?? 0);
  });

  return pointsByRoundId;
}

export function buildRoundPoints({
  participationPoints,
  strokePositionPoints,
  puttPositionPoints,
  scores,
  greenies,
  pointRules,
}: {
  participationPoints: number;
  strokePositionPoints: number;
  puttPositionPoints: number;
  scores: RoundScoreForPoints[];
  greenies: GreenieForPoints[];
  pointRules: PointRules;
}) {
  const holePoints = getHoleScorePoints(scores, pointRules);

  return toRoundPoints({
    ...holePoints,
    participation: participationPoints,
    strokes: strokePositionPoints,
    putts: puttPositionPoints,
    greenies: getGreeniePoints(greenies, pointRules),
  });
}

export function buildPlayerStandings<
  TUser,
  TRound extends PlayerRoundPoints<TUser>,
>(rounds: TRound[], { roundLimit = 10 }: { roundLimit?: number } = {}) {
  const roundsByUserId = new Map<string, TRound[]>();

  for (const round of rounds) {
    const playerRounds = roundsByUserId.get(round.userId) ?? [];
    playerRounds.push(round);
    roundsByUserId.set(round.userId, playerRounds);
  }

  return Array.from(roundsByUserId.entries())
    .map(([userId, playerRounds]) => {
      const rankedRounds = [...playerRounds].sort(compareRoundPointTotals);
      const counted = rankedRounds.slice(0, roundLimit);
      const countedRoundIds = new Set(counted.map((round) => round.roundId));

      return {
        position: 0,
        userId,
        user: playerRounds[0].user,
        roundsPlayed: playerRounds.length,
        countedRounds: counted.length,
        droppedRounds: Math.max(0, playerRounds.length - counted.length),
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

function compareRoundPointTotals<TUser, TRound extends PlayerRoundPoints<TUser>>(
  a: TRound,
  b: TRound,
) {
  const pointsCompare = b.points.total - a.points.total;
  if (pointsCompare !== 0) return pointsCompare;
  return a.roundId - b.roundId;
}

function comparePlayerStandingTotals<
  TUser,
  TRound extends PlayerRoundPoints<TUser>,
>(a: PlayerStanding<TUser, TRound>, b: PlayerStanding<TUser, TRound>) {
  const pointsCompare = b.points.total - a.points.total;
  if (pointsCompare !== 0) return pointsCompare;

  const roundsCompare = b.countedRounds - a.countedRounds;
  if (roundsCompare !== 0) return roundsCompare;

  return a.userId.localeCompare(b.userId);
}
