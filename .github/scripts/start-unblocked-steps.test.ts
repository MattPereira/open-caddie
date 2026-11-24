import { describe, expect, it } from "vitest";
import { type GitHub, stepsToStart } from "./start-unblocked-steps";

const DEPLOYED = "deployed-sha";

const switchStep = {
  number: 260,
  body: "Start once the production deploy of #95 succeeded.\n\nSwitch step.",
};
const expandPull = {
  number: 261,
  body: "Part of #95; switch is #260.",
  mergeCommit: "expand-merge",
};

function fakeGitHub(overrides: Partial<GitHub> = {}): GitHub {
  return {
    openIssues: async () => [switchStep],
    mergedPullsMentioning: async (issue) => (issue === 95 ? [expandPull] : []),
    isAncestor: async (commit, of) =>
      commit === "expand-merge" && of === DEPLOYED,
    alreadyStarted: async () => false,
    ...overrides,
  };
}

describe("stepsToStart", () => {
  it("starts a step whose blocker's merged PR is in the deploy", async () => {
    expect(await stepsToStart(DEPLOYED, fakeGitHub())).toEqual([
      { issue: 260, blocker: 95, pull: 261 },
    ]);
  });

  it("starts nothing when the deploy does not contain the merge", async () => {
    const gh = fakeGitHub({ isAncestor: async () => false });
    expect(await stepsToStart(DEPLOYED, gh)).toEqual([]);
  });

  it("ignores issues that do not open with the blocker line", async () => {
    const gh = fakeGitHub({
      openIssues: async () => [
        {
          number: 300,
          body: "Unrelated.\n\nStart once the production deploy of #95 succeeded.",
        },
      ],
      mergedPullsMentioning: async () => [expandPull],
    });
    expect(await stepsToStart(DEPLOYED, gh)).toEqual([]);
  });

  it("counts a PR that closes the blocker", async () => {
    const gh = fakeGitHub({
      mergedPullsMentioning: async () => [
        { ...expandPull, body: "Fixes #95." },
      ],
    });
    expect(await stepsToStart(DEPLOYED, gh)).toHaveLength(1);
  });

  it("does not count a PR that only mentions the blocker in passing", async () => {
    const gh = fakeGitHub({
      mergedPullsMentioning: async () => [
        { ...expandPull, body: "Closes #262. E.g. #260 after #95." },
        { ...expandPull, body: "Part of #950." },
      ],
    });
    expect(await stepsToStart(DEPLOYED, gh)).toEqual([]);
  });

  it("does not start a step a previous deploy already started", async () => {
    const gh = fakeGitHub({ alreadyStarted: async (issue) => issue === 260 });
    expect(await stepsToStart(DEPLOYED, gh)).toEqual([]);
  });
});
