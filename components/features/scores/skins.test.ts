import { describe, expect, it } from "vitest";

import type { NetScoringRound } from "@/lib/rounds/reads";

import { isEligibleSkinsRound, toSkinsView } from "./skins";

const holes = Array.from({ length: 18 }, (_, index) => ({
  hole: index + 1,
  par: 4,
  handicap: index + 1,
}));

function round(
  id: number,
  strokesByHole: Partial<Record<number, number | null>>,
  kind: NetScoringRound["kind"] = "match",
): NetScoringRound {
  const scores = holes.map((hole) => ({
    hole: hole.hole,
    strokes: strokesByHole[hole.hole] ?? null,
  }));

  return {
    kind,
    id,
    userId: `user-${id}`,
    firstName: `Player ${id}`,
    lastName: null,
    username: null,
    image: null,
    recordedStrokesCount: scores.filter((score) => score.strokes != null)
      .length,
    playingHandicap: 0,
    scores,
  };
}

describe("isEligibleSkinsRound", () => {
  it("includes exactly the Match Rounds with a recorded score", () => {
    const rounds = [
      round(1, { 1: 4 }),
      round(2, {}),
      round(3, { 1: 4 }, "tournament"),
      round(4, { 1: 4 }, "casual"),
    ];

    expect(rounds.filter(isEligibleSkinsRound).map((r) => r.id)).toEqual([1]);
  });
});

describe("toSkinsView", () => {
  it("carries a tied completed hole into the next unique low score", () => {
    const result = toSkinsView([
      round(1, { 1: 4, 2: 4 }),
      round(2, { 1: 4, 2: 5 }),
    ], holes);

    expect(result.holes.slice(0, 2)).toMatchObject([
      { winningRoundId: null, skinsAwarded: 0 },
      { winningRoundId: 1, skinsAwarded: 2 },
    ]);
    expect(result.players).toMatchObject([
      { id: 1, skinsWon: 2 },
      { id: 2, skinsWon: 0 },
    ]);
  });

  it("neither awards nor carries an incomplete hole", () => {
    const result = toSkinsView([
      round(1, { 1: 4, 2: 4 }),
      round(2, { 1: null, 2: 5 }),
    ], holes);

    expect(result.holes.slice(0, 2)).toMatchObject([
      { winningRoundId: null, skinsAwarded: 0 },
      { winningRoundId: 1, skinsAwarded: 1 },
    ]);
    expect(result.players[0].skinsWon).toBe(1);
  });
});
