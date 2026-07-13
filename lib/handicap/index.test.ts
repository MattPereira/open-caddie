import { describe, expect, it } from "vitest";

import { assessHandicap } from "./index";

describe("assessHandicap", () => {
  it("derives a Course Handicap and net strokes from a Player Index Override", () => {
    const result = assessHandicap({
      source: { kind: "override", playerIndex: 10 },
      slope: 113,
      totalStrokes: 90,
      isComplete: true,
    });

    expect(result.playerIndex).toBe(10);
    expect(result.courseHandicap).toBe(10);
    expect(result.netStrokes).toBe(80);
    expect(result.usedDifferentialIndexes).toEqual([]);
  });

  it("populates playerIndex for an override even when the value is 0", () => {
    const result = assessHandicap({
      source: { kind: "override", playerIndex: 0 },
      slope: 113,
      totalStrokes: 90,
      isComplete: true,
    });

    expect(result.playerIndex).toBe(0);
    expect(result.courseHandicap).toBe(0);
    expect(result.netStrokes).toBe(90);
  });

  it("computes a Player Index from prior differentials", () => {
    const result = assessHandicap({
      source: { kind: "computed", priorDifferentials: [12, 8, 20, 16] },
      slope: 113,
      totalStrokes: 90,
      isComplete: true,
    });

    // best 2 of [12, 8, 20, 16] are 8 and 12 -> index 10
    expect(result.playerIndex).toBe(10);
    expect(result.courseHandicap).toBe(10);
    expect(result.netStrokes).toBe(80);
  });

  it("scales the Player Index by the course slope", () => {
    const result = assessHandicap({
      source: { kind: "computed", priorDifferentials: [12, 8] },
      slope: 120,
      totalStrokes: 90,
      isComplete: true,
    });

    expect(result.playerIndex).toBe(10);
    expect(result.courseHandicap).toBeCloseTo((10 * 120) / 113, 10);
  });

  it("returns a null Player Index when there are too few differentials", () => {
    const result = assessHandicap({
      source: { kind: "computed", priorDifferentials: [15] },
      slope: 113,
      totalStrokes: 90,
      isComplete: true,
    });

    expect(result.playerIndex).toBeNull();
    expect(result.usedDifferentialIndexes).toEqual([]);
    // a null index scales to a zero Course Handicap
    expect(result.courseHandicap).toBe(0);
    expect(result.netStrokes).toBe(90);
  });

  it("selects the best 2 of the last 4 differentials and reports their indexes", () => {
    const result = assessHandicap({
      // only the last 4 ([10, 9, 8, 7]) are eligible; the best-scoring 6 at
      // index 4 is excluded, so this is best-2-of-4, not best-2-of-all
      source: { kind: "computed", priorDifferentials: [10, 9, 8, 7, 6] },
      slope: 113,
      totalStrokes: 90,
      isComplete: true,
    });

    expect(result.usedDifferentialIndexes).toEqual([3, 2]);
    expect(result.playerIndex).toBe(7.5);
  });

  it("returns null net strokes for an incomplete round", () => {
    const result = assessHandicap({
      source: { kind: "computed", priorDifferentials: [12, 8] },
      slope: 113,
      totalStrokes: 90,
      isComplete: false,
    });

    expect(result.netStrokes).toBeNull();
    // the Course Handicap is still derived
    expect(result.courseHandicap).toBe(10);
  });
});
