import { describe, expect, it } from "vitest";

import { matchFormatLabel, matchPlayContestTitle } from "@/modules/matches";

describe("matchFormatLabel", () => {
  it("labels each format by its glossary name", () => {
    expect(matchFormatLabel("singles_match_play")).toBe("Singles");
    expect(matchFormatLabel("three_ball_match_play")).toBe("Three-Ball");
    expect(matchFormatLabel("four_ball_match_play")).toBe("Four-Ball");
  });

  it("has no label without a format", () => {
    expect(matchFormatLabel(null)).toBeNull();
    expect(matchFormatLabel(undefined)).toBeNull();
  });
});

describe("matchPlayContestTitle", () => {
  it("titles the Singles contest Match Play", () => {
    expect(
      matchPlayContestTitle("singles_match_play", ["Ann Lee", "Bo Kim"]),
    ).toBe("Match Play");
  });

  it("titles each Three-Ball contest by its pair of Players", () => {
    expect(
      matchPlayContestTitle("three_ball_match_play", ["Ann Lee", "Bo Kim"]),
    ).toBe("Ann Lee vs Bo Kim");
  });

  it("titles the Four-Ball contest by its format", () => {
    expect(
      matchPlayContestTitle("four_ball_match_play", ["AL/BK", "CD/EF"]),
    ).toBe("Four-Ball");
  });
});
