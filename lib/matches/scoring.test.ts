import { describe, expect, it } from "vitest";

import { scoreMatchPlay, scoreSkins, type ScoringRound } from "./scoring";

const holes = Array.from({ length: 18 }, (_, index) => ({
  hole: index + 1,
  handicap: index + 1,
}));

function round(
  id: number,
  playingHandicap: number | null,
  strokesByHole: Partial<Record<number, number | null>> = {},
): ScoringRound {
  const scores = holes.map(({ hole }) => ({
    hole,
    strokes: strokesByHole[hole] ?? null,
  }));
  return {
    id,
    userId: `player-${id}`,
    kind: "match",
    playingHandicap,
    recordedStrokesCount: scores.filter((score) => score.strokes != null)
      .length,
    scores,
  };
}

describe("scoreMatchPlay", () => {
  it("scores Four-Ball at 90% and selects each team's lowest net score", () => {
    const result = scoreMatchPlay({
      holes,
      format: "four_ball_match_play",
      rounds: [],
      teams: [
        { id: 10, rounds: [round(1, 0, { 5: 4 }), round(2, 10, { 5: 5 })] },
        { id: 20, rounds: [round(3, 11, { 5: 4 }), round(4, 20, { 5: 6 })] },
      ],
    });
    if (result.status !== "ready") throw new Error("Expected ready Match Play");
    expect(result.contests[0].holes[4]).toMatchObject({
      winningTeamId: "20",
      teams: [
        {
          netScore: 4,
          players: [
            { playerId: 1, netScore: 4, receivedStrokes: 0 },
            { playerId: 2, netScore: 4, receivedStrokes: 1 },
          ],
        },
        {
          netScore: 3,
          players: [
            { playerId: 3, netScore: 3, receivedStrokes: 1 },
            { playerId: 4, netScore: 5, receivedStrokes: 1 },
          ],
        },
      ],
    });
  });

  it.each([
    { format: "singles_match_play", count: 1 },
    { format: "singles_match_play", count: 3 },
    { format: "three_ball_match_play", count: 2 },
    { format: "three_ball_match_play", count: 4 },
  ] satisfies {
    format: Parameters<typeof scoreMatchPlay>[0]["format"];
    count: number;
  }[])(
    "reports unavailable for $format with $count eligible Rounds",
    ({ format, count }) => {
      expect(
        scoreMatchPlay({
          holes,
          format,
          rounds: Array.from({ length: count }, (_, i) => round(i, 0)),
        }),
      ).toEqual({ status: "unavailable", reason: "round_count" });
    },
  );

  it("reports unavailable when Four-Ball teams are incomplete", () => {
    expect(
      scoreMatchPlay({
        holes,
        format: "four_ball_match_play",
        rounds: [round(1, 0), round(2, 0), round(3, 0), round(4, 0)],
        teams: [
          { id: 1, rounds: [round(1, 0)] },
          { id: 2, rounds: [round(3, 0), round(4, 0)] },
        ],
      }),
    ).toEqual({ status: "unavailable", reason: "teams" });
  });

  it("includes exactly Match Rounds in Match Play", () => {
    for (const kind of ["tournament", "casual"] as const) {
      expect(
        scoreMatchPlay({
          holes,
          format: "singles_match_play",
          rounds: [round(1, 0), { ...round(2, 0), kind }],
        }),
      ).toEqual({ status: "unavailable", reason: "round_count" });
    }
  });

  it("keeps a full roster ready before scores have been entered", () => {
    const result = scoreMatchPlay({
      holes,
      format: "singles_match_play",
      rounds: [round(1, 0), round(2, 0)],
    });
    if (result.status !== "ready") throw new Error("Expected ready Match Play");
    expect(result.contests[0]).toMatchObject({
      state: "unstarted",
      holesCompleted: 0,
      holesRemaining: 18,
    });
    expect(result.contests[0].holes[0]).toMatchObject({
      winningTeamId: null,
      status: null,
    });
  });

  it("returns a semantic close-out when the lead exceeds holes remaining", () => {
    const a = Object.fromEntries(
      Array.from({ length: 16 }, (_, i) => [i + 1, 4]),
    );
    const b = { ...a, 1: 5, 2: 5, 3: 5 };
    const result = scoreMatchPlay({
      holes,
      format: "singles_match_play",
      rounds: [round(1, 0, a), round(2, 0, b)],
    });
    if (result.status !== "ready") throw new Error("Expected ready Match Play");
    expect(result.contests[0]).toMatchObject({
      state: "closed",
      holesCompleted: 16,
      holesRemaining: 2,
      finalStatus: { leadingTeamId: "player-1", holesUp: 3 },
    });
  });

  it("returns a tied final result when every hole is halved", () => {
    const scores = Object.fromEntries(
      Array.from({ length: 18 }, (_, i) => [i + 1, 4]),
    );
    const result = scoreMatchPlay({
      holes,
      format: "singles_match_play",
      rounds: [round(1, 0, scores), round(2, 0, scores)],
    });
    if (result.status !== "ready") throw new Error("Expected ready Match Play");
    expect(result.contests[0]).toMatchObject({
      state: "complete",
      holesCompleted: 18,
      holesRemaining: 0,
      finalStatus: { leadingTeamId: null, holesUp: 0 },
    });
  });

  it("rounds relative handicaps and distributes more than 18 received strokes", () => {
    const scores = Object.fromEntries(
      Array.from({ length: 18 }, (_, i) => [i + 1, 5]),
    );
    const result = scoreMatchPlay({
      holes,
      format: "singles_match_play",
      rounds: [round(1, 4.2, scores), round(2, 23.7, scores)],
    });
    if (result.status !== "ready") throw new Error("Expected ready Match Play");
    expect(result.contests[0].teams[1].receivedStrokes).toBe(20);
    expect(result.contests[0].holes[0].playerScores[1]).toMatchObject({
      receivedStrokes: 2,
      netScore: 3,
    });
  });

  it("uses scratch for an absent Playing Handicap and no strokes for null hole handicap", () => {
    const high = round(2, 1, { 1: 4 });

    const result = scoreMatchPlay({
      format: "singles_match_play",
      rounds: [round(1, null, { 1: 4 }), high],
      holes: [{ hole: 1, handicap: null }],
    });
    if (result.status !== "ready") throw new Error("Expected ready Match Play");
    expect(result.contests[0].holes[0]).toMatchObject({
      winningTeamId: null,
      playerScores: [
        { netScore: 4, receivedStrokes: 0 },
        { netScore: 4, receivedStrokes: 0 },
      ],
    });
  });

  it("scores all three Three-Ball contests with independent handicap baselines", () => {
    const result = scoreMatchPlay({
      holes,
      format: "three_ball_match_play",
      rounds: [
        round(1, 4, { 2: 4 }),
        round(2, 5, { 2: 4 }),
        round(3, 6, { 2: 4 }),
      ],
    });
    if (result.status !== "ready") throw new Error("Expected ready Match Play");
    expect(
      result.contests.map((contest) => contest.teams.map((team) => team.id)),
    ).toEqual([
      ["player-1", "player-2"],
      ["player-1", "player-3"],
      ["player-2", "player-3"],
    ]);
    expect(
      result.contests.map((contest) => contest.holes[1].winningTeamId),
    ).toEqual([null, "player-3", null]);
  });

  it("scores Singles using relative Playing Handicaps", () => {
    const result = scoreMatchPlay({
      holes,
      format: "singles_match_play",
      rounds: [round(1, 4, { 1: 4 }), round(2, 5, { 1: 4 })],
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("Expected ready Match Play");
    expect(result.contests[0].holes[0]).toMatchObject({
      winningTeamId: "player-2",
      playerScores: [
        { roundId: 1, netScore: 4, receivedStrokes: 0, wonHole: false },
        { roundId: 2, netScore: 3, receivedStrokes: 1, wonHole: true },
      ],
    });
    expect(result.contests[0]).toMatchObject({
      holesCompleted: 1,
      holesRemaining: 17,
      state: "in_progress",
      finalStatus: { leadingTeamId: "player-2", holesUp: 1 },
      teams: [{ holesWon: 0 }, { holesWon: 1 }],
    });
  });
});

describe("scoreSkins", () => {
  it("includes the full Match roster and excludes Tournament and casual Rounds", () => {
    const result = scoreSkins(
      [
        round(1, 0, { 1: 4 }),
        round(2, 0, { 1: 5 }),
        round(3, 0),
        { ...round(4, 0, { 1: 3 }), kind: "tournament" },
        { ...round(5, 0, { 1: 3 }), kind: "casual" },
      ],
      holes,
    );
    if (result.status !== "ready") throw new Error("Expected ready Skins");
    expect(result.players.map((player) => player.id)).toEqual([1, 2, 3]);
    expect(result.holes[0]).toMatchObject({
      winningRoundId: null,
      skinsAwarded: 0,
    });
  });

  it("keeps handicaps stable when an unstarted player records their first score", () => {
    const started = [round(1, 4, { 5: 4, 6: 4 }), round(2, 5, { 5: 5, 6: 5 })];
    const before = scoreSkins([...started, round(3, 0)], holes);
    const after = scoreSkins([...started, round(3, 0, { 6: 6 })], holes);
    if (before.status !== "ready" || after.status !== "ready") {
      throw new Error("Expected ready Skins");
    }
    expect(before.holes[4]).toMatchObject({
      winningRoundId: null,
      skinsAwarded: 0,
      players: [
        { roundId: 1, netScore: 4, receivedStrokes: 0 },
        { roundId: 2, netScore: 4, receivedStrokes: 1 },
        { roundId: 3, netScore: null, receivedStrokes: 0 },
      ],
    });
    expect(after.holes[4]).toEqual(before.holes[4]);

    const completed = scoreSkins([...started, round(3, 0, { 5: 5, 6: 6 })], holes);
    if (completed.status !== "ready") throw new Error("Expected ready Skins");
    expect(completed.holes[4]).toMatchObject({
      winningRoundId: null,
      skinsAwarded: 0,
    });
    expect(after.holes[5]).toMatchObject({ winningRoundId: 1, skinsAwarded: 1 });
    expect(completed.holes[5]).toMatchObject({ winningRoundId: 1, skinsAwarded: 2 });
  });
  it("reports unavailable until at least two players can be scored", () => {
    expect(scoreSkins([], holes)).toEqual({
      status: "unavailable",
      reason: "players_with_scores",
    });
    expect(scoreSkins([round(1, 0, { 1: 4 })], holes)).toEqual({
      status: "unavailable",
      reason: "players_with_scores",
    });
  });

  it("awards no Skins on an incomplete hole", () => {
    const result = scoreSkins(
      [round(1, 0, { 1: 4, 2: 4 }), round(2, 0, { 2: 5 })],
      holes,
    );
    if (result.status !== "ready") throw new Error("Expected ready Skins");
    expect(result.holes.slice(0, 2)).toMatchObject([
      { winningRoundId: null, skinsAwarded: 0 },
      { winningRoundId: 1, skinsAwarded: 1 },
    ]);
  });

  it("uses 100% individual relative handicaps independently of Match Play teams", () => {
    const result = scoreSkins(
      [
        round(1, 0, { 10: 4 }),
        round(2, 10, { 10: 4 }),
        round(3, 20, { 10: 5 }),
      ],
      holes,
    );
    if (result.status !== "ready") throw new Error("Expected ready Skins");
    expect(result.holes[9]).toMatchObject({
      winningRoundId: 2,
      skinsAwarded: 1,
    });
    expect(result.holes[9].players).toMatchObject([
      { roundId: 1, receivedStrokes: 0 },
      { roundId: 2, receivedStrokes: 1 },
      { roundId: 3, receivedStrokes: 1 },
    ]);
  });

  it("carries tied completed holes into the next unique low score", () => {
    const result = scoreSkins(
      [round(1, 0, { 1: 4, 2: 4 }), round(2, 0, { 1: 4, 2: 5 })],
      holes,
    );
    if (result.status !== "ready") throw new Error("Expected ready Skins");
    expect(result.holes.slice(0, 2)).toMatchObject([
      { winningRoundId: null, skinsAwarded: 0 },
      { winningRoundId: 1, skinsAwarded: 2 },
    ]);
    expect(result.players).toMatchObject([
      { id: 1, skinsWon: 2 },
      { id: 2, skinsWon: 0 },
    ]);
  });
});
