import { describe, expect, it } from "vitest";

import { matchFormatLabel } from "@/modules/matches";

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
