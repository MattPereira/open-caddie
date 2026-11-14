import { describe, expect, it } from "vitest";

import type { PointRules } from "../point-rules";
import {
  computeSeasonStandings,
  type SeasonStandingsRoundInput,
  type SeasonStandingsTournamentInput,
} from "../index";

const pointRules: PointRules = {
  participation: 10,
  pars: 1,
  birdies: 3,
  eagles: 5,
  aces: 15,
  strokes: { positions: [20, 10, 5] },
  putts: { positions: [8, 4] },
  greenies: {
    tiers: [
      { maxFt: 3, pts: 6 },
      { maxFt: 10, pts: 3 },
      { maxFt: null, pts: 1 },
    ],
  },
};

function tournament(id: number): SeasonStandingsTournamentInput {
  return {
    id,
    date: new Date(`2026-01-${String(id).padStart(2, "0")}T00:00:00.000Z`),
    season: 1,
    courseId: 1,
    courseHandle: "course",
    courseName: "Course",
  };
}

let nextRoundId = 1;

// An incomplete Round with no scores or Greenies: participation points only.
function round(
  playerId: string,
  tournamentId = 1,
  overrides: Partial<SeasonStandingsRoundInput> = {},
): SeasonStandingsRoundInput {
  return {
    id: nextRoundId++,
    tournamentId,
    playerId,
    email: null,
    firstName: null,
    lastName: playerId,
    username: null,
    image: null,
    date: tournament(tournamentId).date,
    courseId: 1,
    courseHandle: "course",
    courseName: "Course",
    totalStrokes: 90,
    totalPutts: 0,
    recordedPuttsCount: 0,
    isComplete: false,
    playerIndex: null,
    playingHandicap: 0,
    netStrokes: null,
    scores: [],
    greenies: [],
    ...overrides,
  };
}

function completeRound(
  playerId: string,
  netStrokes: number,
  overrides: Partial<SeasonStandingsRoundInput> = {},
) {
  return round(playerId, 1, {
    isComplete: true,
    totalStrokes: netStrokes,
    netStrokes,
    ...overrides,
  });
}

type Options = {
  tournaments?: SeasonStandingsTournamentInput[];
  countedRoundLimit?: number;
};

function compute(
  rounds: SeasonStandingsRoundInput[],
  { tournaments = [tournament(1)], countedRoundLimit = 10 }: Options = {},
) {
  return computeSeasonStandings({
    pointRules,
    countedRoundLimit,
    tournaments,
    rounds,
  });
}

function pointsOf(roundToScore: SeasonStandingsRoundInput) {
  return compute([roundToScore]).tournaments[0].rounds[0].points;
}

function pointsByPlayer(rounds: SeasonStandingsRoundInput[]) {
  return Object.fromEntries(
    compute(rounds).tournaments[0].rounds.map((r) => [r.playerId, r.points]),
  );
}

function score(hole: number, par: number, strokes: number | null) {
  return { hole, par, strokes };
}

function greenie(feet: number, inches = 0) {
  return { feet, inches };
}

describe("computeSeasonStandings", () => {
  it("gives every Tournament Round participation points", () => {
    expect(pointsOf(round("a"))).toMatchObject({ participation: 10, total: 10 });
  });

  it("gives par, birdie and eagle points from gross strokes", () => {
    const points = pointsOf(
      round("a", 1, {
        scores: [
          score(1, 4, 4),
          score(2, 4, 3),
          score(3, 5, 3),
          score(4, 5, 2),
          score(5, 4, 5),
          score(6, 4, null),
        ],
      }),
    );

    expect(points).toMatchObject({
      pars: 1,
      birdies: 3,
      eagles: 10,
      aces: 0,
      total: 24,
    });
  });

  it("gives a hole in one ace points only", () => {
    expect(pointsOf(round("a", 1, { scores: [score(1, 3, 1)] }))).toMatchObject({
      pars: 0,
      birdies: 0,
      eagles: 0,
      aces: 15,
      total: 25,
    });
  });

  it("gives no scoring points on a hole without a par", () => {
    expect(
      pointsOf(round("a", 1, { scores: [{ hole: 1, par: null, strokes: 1 }] })),
    ).toMatchObject({ aces: 0, total: 10 });
  });

  it("checks Greenie tiers in order, with the no-maximum tier catching the rest", () => {
    const points = pointsOf(
      round("a", 1, {
        greenies: [greenie(3), greenie(3, 1), greenie(10), greenie(40)],
      }),
    );

    expect(points).toMatchObject({ greenies: 6 + 3 + 3 + 1 });
  });

  it("gives no Greenie points for a distance beyond every tier", () => {
    const { tournaments } = computeSeasonStandings({
      pointRules: {
        ...pointRules,
        greenies: { tiers: [{ maxFt: 3, pts: 6 }, { maxFt: 10, pts: 3 }] },
      },
      countedRoundLimit: 10,
      tournaments: [tournament(1)],
      rounds: [round("a", 1, { greenies: [greenie(10, 1)] })],
    });

    expect(tournaments[0].rounds[0].points).toMatchObject({
      greenies: 0,
      total: 10,
    });
  });

  it("gives Strokes position points by net Tournament Ranking to Complete Rounds only", () => {
    const points = pointsByPlayer([
      completeRound("a", 75, { totalStrokes: 70 }),
      completeRound("b", 70, { totalStrokes: 80 }),
      completeRound("c", 72),
      completeRound("d", 74),
      round("e", 1, { netStrokes: 60, totalStrokes: 60 }),
    ]);

    expect(points.b.strokes).toBe(20);
    expect(points.c.strokes).toBe(10);
    expect(points.d.strokes).toBe(5);
    expect(points.a.strokes).toBe(0);
    expect(points.e.strokes).toBe(0);
  });

  it("gives Putts position points only to Complete Rounds with putts on every hole", () => {
    const points = pointsByPlayer([
      completeRound("a", 72, { totalPutts: 30, recordedPuttsCount: 18 }),
      completeRound("b", 72, { totalPutts: 25, recordedPuttsCount: 17 }),
      completeRound("c", 72, { totalPutts: 32, recordedPuttsCount: 18 }),
      round("d", 1, { totalPutts: 20, recordedPuttsCount: 18 }),
    ]);

    expect(points.a.putts).toBe(8);
    expect(points.c.putts).toBe(4);
    expect(points.b.putts).toBe(0);
    expect(points.d.putts).toBe(0);
  });

  it("does not share position points between tied Rounds", () => {
    const points = pointsByPlayer([
      completeRound("b", 72, { totalPutts: 30, recordedPuttsCount: 18 }),
      completeRound("a", 72, { totalPutts: 30, recordedPuttsCount: 18 }),
    ]);

    expect(points.a).toMatchObject({ strokes: 20, putts: 8 });
    expect(points.b).toMatchObject({ strokes: 10, putts: 4 });
  });

  it("still gives an incomplete Round participation, scoring and Greenie points", () => {
    expect(
      pointsOf(
        round("a", 1, { scores: [score(1, 4, 3)], greenies: [greenie(2)] }),
      ),
    ).toEqual({
      participation: 10,
      strokes: 0,
      putts: 0,
      greenies: 6,
      pars: 0,
      birdies: 3,
      eagles: 0,
      aces: 0,
      total: 19,
    });
  });

  it("orders each Tournament's Rounds by points", () => {
    const { tournaments } = compute([
      round("a"),
      completeRound("b", 72),
      round("c", 1, { greenies: [greenie(1)] }),
    ]);

    expect(tournaments[0].rounds.map((r) => r.playerId)).toEqual(["b", "c", "a"]);
  });

  it("orders a Tournament's equal-point Rounds by Player name", () => {
    const { tournaments } = compute([
      round("p1", 1, { lastName: "Zed" }),
      round("p2", 1, { lastName: "Adams" }),
    ]);

    expect(tournaments[0].rounds.map((r) => r.playerId)).toEqual(["p2", "p1"]);
  });

  it("adds only Counted Rounds to a Player's total and marks the rest dropped", () => {
    const tournaments = [tournament(1), tournament(2), tournament(3)];
    const low = round("a", 1);
    const high = round("a", 2, { greenies: [greenie(1)] });
    const mid = round("a", 3, { greenies: [greenie(20)] });

    const [standing] = compute([low, high, mid], {
      tournaments,
      countedRoundLimit: 2,
    }).players;

    expect(standing).toMatchObject({
      roundsPlayed: 3,
      countedRounds: 2,
      droppedRounds: 1,
      points: { total: 16 + 11, greenies: 7 },
    });
    expect(
      standing.roundBreakdown.map((r) => [r.id, r.counted]),
    ).toEqual([
      [high.id, true],
      [mid.id, true],
      [low.id, false],
    ]);
  });

  it("counts up to the given countedRoundLimit", () => {
    const tournaments = [tournament(1), tournament(2), tournament(3)];
    const rounds = () => tournaments.map((t) => round("a", t.id));

    expect(
      compute(rounds(), { tournaments, countedRoundLimit: 1 }).players[0],
    ).toMatchObject({ countedRounds: 1, droppedRounds: 2, points: { total: 10 } });
    expect(
      compute(rounds(), { tournaments, countedRoundLimit: 3 }).players[0],
    ).toMatchObject({ countedRounds: 3, droppedRounds: 0, points: { total: 30 } });
    expect(
      compute(rounds(), { tournaments, countedRoundLimit: 5 }).players[0],
    ).toMatchObject({ countedRounds: 3, droppedRounds: 0, points: { total: 30 } });
  });

  it("counts a Player's equal-point Rounds in Round order", () => {
    const tournaments = [tournament(1), tournament(2), tournament(3)];
    const first = round("a", 3);
    const second = round("a", 1);
    const third = round("a", 2);

    const [standing] = compute([third, first, second], {
      tournaments,
      countedRoundLimit: 2,
    }).players;

    expect(
      standing.roundBreakdown.map((r) => [r.id, r.counted]),
    ).toEqual([
      [first.id, true],
      [second.id, true],
      [third.id, false],
    ]);
  });

  it("orders Players by points total", () => {
    const tournaments = [tournament(1), tournament(2)];
    const { players } = compute(
      [
        round("one-round", 1, { greenies: [greenie(1), greenie(20)] }),
        round("two-rounds", 1, { greenies: [greenie(20)] }),
        round("two-rounds", 2),
        round("leader", 1, { greenies: [greenie(1), greenie(1)] }),
      ],
      { tournaments },
    );

    expect(
      players.map((p) => [p.position, p.playerId, p.points.total]),
    ).toEqual([
      [1, "leader", 22],
      [2, "two-rounds", 21],
      [3, "one-round", 17],
    ]);
  });

  it("breaks a points tie by number of Counted Rounds", () => {
    const tournaments = [tournament(1), tournament(2)];
    const { players } = compute(
      [
        round("one-round", 1, {
          greenies: [greenie(1), greenie(20), greenie(20), greenie(20), greenie(20)],
        }),
        round("two-rounds", 1),
        round("two-rounds", 2),
      ],
      { tournaments },
    );

    expect(players.map((p) => [p.playerId, p.points.total])).toEqual([
      ["two-rounds", 20],
      ["one-round", 20],
    ]);
  });

  it("breaks a remaining tie by Player id, not name", () => {
    const { players } = compute([
      round("b", 1, { lastName: "Adams" }),
      round("a", 1, { lastName: "Zed" }),
    ]);

    expect(players.map((p) => [p.position, p.playerId])).toEqual([
      [1, "a"],
      [2, "b"],
    ]);
  });

  it("returns empty Standings for an empty Season", () => {
    expect(compute([], { tournaments: [] })).toEqual({
      tournaments: [],
      players: [],
    });
  });

  it("keeps a Tournament with no Rounds", () => {
    expect(compute([]).tournaments).toEqual([{ ...tournament(1), rounds: [] }]);
  });
});
