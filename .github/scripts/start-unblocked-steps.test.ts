import { describe, expect, it } from "vitest";
import { type GitHub, stepsToStart } from "./start-unblocked-steps";

const DEPLOYED = "deployed-sha";

const switchStep = { number: 260, blockers: [265] };
const expandPull = { number: 261, mergeCommit: "expand-merge" };

function fakeGitHub(overrides: Partial<GitHub> = {}): GitHub {
  return {
    awaitingDeploy: async () => [switchStep],
    mergedClosingPulls: async (issue) => (issue === 265 ? [expandPull] : []),
    isAncestor: async (commit, of) =>
      commit === "expand-merge" && of === DEPLOYED,
    ...overrides,
  };
}

describe("stepsToStart", () => {
  it("starts a step once the PR closing its blocker is in the deploy", async () => {
    expect(await stepsToStart(DEPLOYED, fakeGitHub())).toEqual([
      { issue: 260, pulls: [261] },
    ]);
  });

  it("starts nothing when the deploy does not contain the blocker's PR", async () => {
    const gh = fakeGitHub({ isAncestor: async () => false });
    expect(await stepsToStart(DEPLOYED, gh)).toEqual([]);
  });

  it("does not start a step with no blocker to wait on", async () => {
    const gh = fakeGitHub({
      awaitingDeploy: async () => [{ number: 260, blockers: [] }],
    });
    expect(await stepsToStart(DEPLOYED, gh)).toEqual([]);
  });

  it("waits until every blocker's PR is in the deploy", async () => {
    const gh = fakeGitHub({
      awaitingDeploy: async () => [{ number: 260, blockers: [265, 266] }],
      mergedClosingPulls: async (issue) =>
        issue === 265
          ? [expandPull]
          : [{ number: 267, mergeCommit: "later-merge" }],
    });
    expect(await stepsToStart(DEPLOYED, gh)).toEqual([]);
  });

  it("starts nothing while the blocker has no merged closing PR", async () => {
    const gh = fakeGitHub({ mergedClosingPulls: async () => [] });
    expect(await stepsToStart(DEPLOYED, gh)).toEqual([]);
  });
});
