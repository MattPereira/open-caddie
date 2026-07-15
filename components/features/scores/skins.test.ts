import { describe, expect, it } from "vitest";

import { toSkinsView, type SkinsRound } from "./skins";

function round(
  id: number,
  strokesByHole: Partial<Record<number, number | null>>,
): SkinsRound {
  const holes = Array.from({ length: 18 }, (_, index) => ({
    hole: index + 1,
    par: 4,
    handicap: index + 1,
  }));
  const scores = holes.map((hole) => ({
    ...hole,
    strokes: strokesByHole[hole.hole] ?? null,
    putts: null,
  }));

  return {
    id,
    firstName: `Player ${id}`,
    lastName: null,
    username: null,
    image: null,
    recordedStrokesCount: scores.filter((score) => score.strokes != null)
      .length,
    recordedPuttsCount: 0,
    totalStrokes: 0,
    totalPutts: 0,
    playingHandicap: 0,
    netStrokes: null,
    scores,
    holes,
  };
}

describe("toSkinsView", () => {
  it("carries a tied completed hole into the next unique low score", () => {
    const result = toSkinsView([
      round(1, { 1: 4, 2: 4 }),
      round(2, { 1: 4, 2: 5 }),
    ]);

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
    ]);

    expect(result.holes.slice(0, 2)).toMatchObject([
      { winningRoundId: null, skinsAwarded: 0 },
      { winningRoundId: 1, skinsAwarded: 1 },
    ]);
    expect(result.players[0].skinsWon).toBe(1);
  });
});
