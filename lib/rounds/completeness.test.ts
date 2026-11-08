import { describe, expect, it } from "vitest";
import { HOLE_COUNT, HOLE_NUMBERS, hasAllPutts, isComplete } from "./completeness";

const counts = (recordedStrokesCount: number, recordedPuttsCount: number) => ({
  recordedStrokesCount,
  recordedPuttsCount,
});

describe("Round completeness", () => {
  it("numbers every hole once", () => {
    expect(HOLE_NUMBERS).toHaveLength(HOLE_COUNT);
    expect(HOLE_NUMBERS[0]).toBe(1);
    expect(HOLE_NUMBERS.at(-1)).toBe(18);
  });

  it("is incomplete with 17 strokes", () => {
    expect(isComplete(counts(17, 17))).toBe(false);
    expect(hasAllPutts(counts(17, 17))).toBe(false);
  });

  it("is complete with 18 strokes even when putts are missing", () => {
    expect(isComplete(counts(18, 0))).toBe(true);
    expect(isComplete(counts(18, 17))).toBe(true);
    expect(hasAllPutts(counts(18, 17))).toBe(false);
  });

  it("has all putts with 18 of each", () => {
    expect(isComplete(counts(18, 18))).toBe(true);
    expect(hasAllPutts(counts(18, 18))).toBe(true);
  });
});
