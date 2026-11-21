import { describe, expect, it } from "vitest";
import { pinFixCommits } from "./fix-commits";
import type { ReviewFix } from "./review-schema";

const fix = (commit: string): ReviewFix => ({
  axis: "standards",
  title: "Duplicated lookup",
  commit,
  rule: "Duplicated Code",
});

const made = [
  { full: "430ae60c2b1d9e8f7a6b5c4d3e2f1a0b9c8d7e6f", short: "430ae60" },
  { full: "97161be0a1b2c3d4e5f60718293a4b5c6d7e8f90", short: "97161be" },
];

describe("pinFixCommits", () => {
  it("shortens a full SHA of a commit the run made", () => {
    const { fixed, unknown } = pinFixCommits(
      [fix("97161be0a1b2c3d4e5f60718293a4b5c6d7e8f90")],
      made,
    );

    expect(fixed).toEqual([fix("97161be")]);
    expect(unknown).toEqual([]);
  });

  it("matches a commit by the prefix the agent wrote", () => {
    const { fixed } = pinFixCommits([fix("430ae60c2b")], made);

    expect(fixed).toEqual([fix("430ae60")]);
  });

  it("keeps a SHA that names no commit the run made, and reports it", () => {
    const { fixed, unknown } = pinFixCommits([fix("deadbee")], made);

    expect(fixed).toEqual([fix("deadbee")]);
    expect(unknown).toEqual(["deadbee"]);
  });
});
