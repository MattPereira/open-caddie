import { describe, expect, it } from "vitest";

import { assessHandicap, calculateNetStrokes } from "../handicap";

function priorRound(id: number, date: string, scoreDifferential: number) {
  return { id, date: new Date(date), scoreDifferential };
}

describe("assessHandicap — Tournament Round", () => {
  it("computes a Player Index from the best 2 prior differentials", () => {
    const result = assessHandicap({
      source: {
        kind: "tournament",
        priorRounds: [
          priorRound(1, "2026-04-01", 12),
          priorRound(2, "2026-03-01", 8),
          priorRound(3, "2026-02-01", 20),
          priorRound(4, "2026-01-01", 16),
        ],
      },
      slope: 113,
      totalStrokes: 90,
      isComplete: true,
    });

    expect(result.playerIndex).toBe(10);
    expect(result.courseHandicap).toBe(10);
    expect(result.playingHandicap).toBe(10);
    expect(result.netStrokes).toBe(80);
    expect(result.usedPriorRoundIds).toEqual([2, 1]);
  });

  it("scales the Player Index by the course slope", () => {
    const result = assessHandicap({
      source: {
        kind: "tournament",
        priorRounds: [
          priorRound(1, "2026-02-01", 12),
          priorRound(2, "2026-01-01", 8),
        ],
      },
      slope: 120,
      totalStrokes: 90,
      isComplete: true,
    });

    expect(result.playerIndex).toBe(10);
    expect(result.playingHandicap).toBeCloseTo((10 * 120) / 113, 10);
  });

  it("windows to the 4 most recent prior Rounds regardless of input order", () => {
    const result = assessHandicap({
      // the oldest Round has the best differential but falls outside the window
      source: {
        kind: "tournament",
        priorRounds: [
          priorRound(1, "2026-01-01", 6),
          priorRound(5, "2026-05-01", 10),
          priorRound(3, "2026-03-01", 8),
          priorRound(4, "2026-04-01", 9),
          priorRound(2, "2026-02-01", 7),
        ],
      },
      slope: 113,
      totalStrokes: 90,
      isComplete: true,
    });

    expect(result.usedPriorRoundIds).toEqual([2, 3]);
    expect(result.playerIndex).toBe(7.5);
  });

  it("breaks same-date ties by the newer Round id", () => {
    const result = assessHandicap({
      source: {
        kind: "tournament",
        priorRounds: [
          priorRound(1, "2026-01-01", 1),
          priorRound(2, "2026-01-01", 20),
          priorRound(3, "2026-01-01", 19),
          priorRound(4, "2026-01-01", 18),
          priorRound(5, "2026-01-01", 17),
        ],
      },
      slope: 113,
      totalStrokes: 90,
      isComplete: true,
    });

    // Round 1 is the oldest by id, so its best differential drops out
    expect(result.usedPriorRoundIds).toEqual([5, 4]);
    expect(result.playerIndex).toBe(17.5);
  });

  it("plays scratch with fewer than 2 prior Rounds", () => {
    const result = assessHandicap({
      source: { kind: "tournament", priorRounds: [priorRound(1, "2026-01-01", 15)] },
      slope: 113,
      totalStrokes: 90,
      isComplete: true,
    });

    expect(result.playerIndex).toBeNull();
    expect(result.usedPriorRoundIds).toEqual([]);
    expect(result.courseHandicap).toBe(0);
    expect(result.playingHandicap).toBe(0);
    expect(result.netStrokes).toBe(90);
  });

  it("returns null net strokes for an incomplete round", () => {
    const result = assessHandicap({
      source: {
        kind: "tournament",
        priorRounds: [
          priorRound(1, "2026-02-01", 12),
          priorRound(2, "2026-01-01", 8),
        ],
      },
      slope: 113,
      totalStrokes: 90,
      isComplete: false,
    });

    expect(result.netStrokes).toBeNull();
    expect(result.playingHandicap).toBe(10);
  });
});

describe("assessHandicap — Match Round", () => {
  it("applies the Player Index Override's Course Handicap", () => {
    const result = assessHandicap({
      source: { kind: "match", playerIndexOverride: 10 },
      slope: 113,
      totalStrokes: 90,
      isComplete: true,
    });

    expect(result.playerIndex).toBe(10);
    expect(result.courseHandicap).toBe(10);
    expect(result.playingHandicap).toBe(10);
    expect(result.netStrokes).toBe(80);
    expect(result.usedPriorRoundIds).toEqual([]);
  });

  it("plays scratch without an override", () => {
    const result = assessHandicap({
      source: { kind: "match", playerIndexOverride: null },
      slope: 130,
      totalStrokes: 90,
      isComplete: true,
    });

    expect(result.playerIndex).toBe(0);
    expect(result.playingHandicap).toBe(0);
    expect(result.netStrokes).toBe(90);
  });
});

describe("assessHandicap — casual Round", () => {
  it("has no Playing Handicap and no net strokes", () => {
    const result = assessHandicap({
      source: { kind: "casual" },
      slope: 113,
      totalStrokes: 90,
      isComplete: true,
    });

    expect(result.playerIndex).toBeNull();
    expect(result.courseHandicap).toBeNull();
    expect(result.playingHandicap).toBeNull();
    expect(result.netStrokes).toBeNull();
    expect(result.usedPriorRoundIds).toEqual([]);
  });
});

describe("calculateNetStrokes", () => {
  it("subtracts the Playing Handicap from a complete Round's total", () => {
    expect(
      calculateNetStrokes({ totalStrokes: 90, isComplete: true, playingHandicap: 12 }),
    ).toBe(78);
  });

  it("is null until the Round is complete", () => {
    expect(
      calculateNetStrokes({ totalStrokes: 45, isComplete: false, playingHandicap: 12 }),
    ).toBeNull();
  });

  it("is null without a Playing Handicap", () => {
    expect(
      calculateNetStrokes({ totalStrokes: 90, isComplete: true, playingHandicap: null }),
    ).toBeNull();
  });
});
