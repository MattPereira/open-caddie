import { describe, expect, it } from "vitest";

import { computeSeasonBackfill } from "./backfill";

describe("computeSeasonBackfill", () => {
  it("creates one Season per distinct (club, season) with the highest number current", () => {
    const seasons = computeSeasonBackfill([
      { clubId: 1, season: 1 },
      { clubId: 1, season: 2 },
      { clubId: 1, season: 3 },
      { clubId: 1, season: 4 },
      { clubId: 1, season: 5 },
    ]);

    expect(seasons).toEqual([
      { clubId: 1, number: 1, isCurrent: false },
      { clubId: 1, number: 2, isCurrent: false },
      { clubId: 1, number: 3, isCurrent: false },
      { clubId: 1, number: 4, isCurrent: false },
      { clubId: 1, number: 5, isCurrent: true },
    ]);
  });

  it("collapses duplicate (club, season) pairs from multiple tournaments", () => {
    const seasons = computeSeasonBackfill([
      { clubId: 1, season: 1 },
      { clubId: 1, season: 1 },
      { clubId: 1, season: 2 },
      { clubId: 1, season: 2 },
    ]);

    expect(seasons).toEqual([
      { clubId: 1, number: 1, isCurrent: false },
      { clubId: 1, number: 2, isCurrent: true },
    ]);
  });

  it("tracks a current Season per club independently", () => {
    const seasons = computeSeasonBackfill([
      { clubId: 1, season: 1 },
      { clubId: 1, season: 2 },
      { clubId: 2, season: 1 },
    ]);

    expect(seasons).toEqual([
      { clubId: 1, number: 1, isCurrent: false },
      { clubId: 1, number: 2, isCurrent: true },
      { clubId: 2, number: 1, isCurrent: true },
    ]);
  });

  it("preserves the highest existing number as current even with gaps", () => {
    const seasons = computeSeasonBackfill([
      { clubId: 1, season: 2 },
      { clubId: 1, season: 5 },
    ]);

    expect(seasons).toEqual([
      { clubId: 1, number: 2, isCurrent: false },
      { clubId: 1, number: 5, isCurrent: true },
    ]);
  });

  it("ignores tournaments without a season number", () => {
    const seasons = computeSeasonBackfill([
      { clubId: 1, season: null },
      { clubId: 1, season: 1 },
    ]);

    expect(seasons).toEqual([{ clubId: 1, number: 1, isCurrent: true }]);
  });

  it("returns nothing when no tournament carries a season", () => {
    expect(computeSeasonBackfill([{ clubId: 1, season: null }])).toEqual([]);
    expect(computeSeasonBackfill([])).toEqual([]);
  });
});
