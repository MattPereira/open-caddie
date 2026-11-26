import { describe, expect, it } from "vitest";
import { previousStepsDeployed, stepsToStart } from "./expand-contract";
import type { GitHub } from "./expand-contract-github";

const expandIssue = 265;
const switchStep = {
  number: 260,
  blockers: [{ number: expandIssue, closed: true }],
};
const expandPull = { number: 261, mergeCommit: "expand-merge" };

function fakeGitHub(overrides: Partial<GitHub> = {}): GitHub {
  return {
    openSteps: async () => [switchStep],
    stepsClosedBy: async () => [],
    mergedClosingPulls: async (issue) =>
      issue === expandIssue ? [expandPull] : [],
    isAncestor: async (commit, of) =>
      commit === "expand-merge" && of === "prod-sha",
    ...overrides,
  };
}

describe("stepsToStart", () => {
  it("starts the step whose blocker's PR is in the deployed commit", async () => {
    expect(await stepsToStart("prod-sha", fakeGitHub())).toEqual([260]);
  });

  it("waits while the blocker's PR is not in the deployed commit", async () => {
    expect(await stepsToStart("older-sha", fakeGitHub())).toEqual([]);
  });

  it("starts nothing when the blocker closed without a merged PR", async () => {
    const gh = fakeGitHub({ mergedClosingPulls: async () => [] });
    expect(await stepsToStart("prod-sha", gh)).toEqual([]);
  });

  it("never starts a step with no blocker", async () => {
    const gh = fakeGitHub({
      openSteps: async () => [{ number: 259, blockers: [] }],
    });
    expect(await stepsToStart("prod-sha", gh)).toEqual([]);
  });

  it("waits while another blocker is open, even one reopened after its PR merged", async () => {
    const gh = fakeGitHub({
      openSteps: async () => [
        {
          number: 260,
          blockers: [
            { number: 265, closed: true },
            { number: 266, closed: false },
          ],
        },
      ],
      mergedClosingPulls: async () => [expandPull],
    });
    expect(await stepsToStart("prod-sha", gh)).toEqual([]);
  });

  it("starts a step only once every blocker's PR is in the deployed commit", async () => {
    const gh = fakeGitHub({
      openSteps: async () => [
        {
          number: 260,
          blockers: [
            { number: 265, closed: true },
            { number: 266, closed: true },
          ],
        },
      ],
      mergedClosingPulls: async (issue) =>
        issue === 265 ? [expandPull] : [{ number: 267, mergeCommit: "other" }],
    });
    expect(await stepsToStart("prod-sha", gh)).toEqual([]);
  });
});

describe("previousStepsDeployed", () => {
  it("passes a PR that closes no expand/contract step", async () => {
    expect(await previousStepsDeployed(999, "prod-sha", fakeGitHub())).toEqual({
      ready: true,
      description: "Not an expand/contract step.",
    });
  });

  it("fails while the blocker's PR is not in production", async () => {
    const gh = fakeGitHub({ stepsClosedBy: async () => [switchStep] });
    expect(await previousStepsDeployed(270, "older-sha", gh)).toEqual({
      ready: false,
      description: "Waiting for #261 (closes #265) in production.",
    });
  });

  it("passes once the blocker's PR is in production", async () => {
    const gh = fakeGitHub({ stepsClosedBy: async () => [switchStep] });
    expect(await previousStepsDeployed(270, "prod-sha", gh)).toEqual({
      ready: true,
      description: "#261 (closes #265) is in production.",
    });
  });

  it("fails while no production deploy is known", async () => {
    const gh = fakeGitHub({
      stepsClosedBy: async () => [switchStep],
      isAncestor: async () => true,
    });
    expect(await previousStepsDeployed(270, undefined, gh)).toMatchObject({
      ready: false,
    });
  });

  it("names a blocker that has no merged PR yet", async () => {
    const gh = fakeGitHub({
      stepsClosedBy: async () => [switchStep],
      mergedClosingPulls: async () => [],
    });
    expect(await previousStepsDeployed(270, "prod-sha", gh)).toEqual({
      ready: false,
      description: "Waiting for a merged PR closing #265 in production.",
    });
  });

  it("passes a step with no blocker to wait on", async () => {
    const gh = fakeGitHub({
      stepsClosedBy: async () => [{ number: 265, blockers: [] }],
    });
    expect(await previousStepsDeployed(261, "prod-sha", gh)).toEqual({
      ready: true,
      description: "No previous step to wait on.",
    });
  });

  it("names every blocker and PR in production", async () => {
    const gh = fakeGitHub({
      stepsClosedBy: async () => [
        {
          number: 260,
          blockers: [
            { number: 265, closed: true },
            { number: 266, closed: true },
          ],
        },
      ],
      mergedClosingPulls: async (issue) =>
        issue === 265
          ? [expandPull, { number: 262, mergeCommit: "redo" }]
          : [{ number: 267, mergeCommit: "other" }],
      isAncestor: async () => true,
    });
    expect(await previousStepsDeployed(270, "prod-sha", gh)).toEqual({
      ready: true,
      description:
        "#261, #262 (closes #265), #267 (closes #266) is in production.",
    });
  });

  it("names every blocker it waits for", async () => {
    const gh = fakeGitHub({
      stepsClosedBy: async () => [
        {
          number: 260,
          blockers: [
            { number: 265, closed: true },
            { number: 266, closed: true },
          ],
        },
      ],
      mergedClosingPulls: async (issue) =>
        issue === 265 ? [expandPull] : [{ number: 267, mergeCommit: "other" }],
      isAncestor: async () => false,
    });
    expect(await previousStepsDeployed(270, "prod-sha", gh)).toEqual({
      ready: false,
      description:
        "Waiting for #261 (closes #265), #267 (closes #266) in production.",
    });
  });
});
