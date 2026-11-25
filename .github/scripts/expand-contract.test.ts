import { describe, expect, it } from "vitest";
import { type GitHub, gateStatus, stepsToStart } from "./expand-contract";

const expandIssue = 265;
const switchStep = {
  number: 260,
  blockers: [{ number: expandIssue, closed: true }],
};
const expandPull = { number: 261, mergeCommit: "expand-merge" };

function fakeGitHub(overrides: Partial<GitHub> = {}): GitHub {
  return {
    stepsBlockedBy: async (issue) =>
      issue === expandIssue ? [switchStep] : [],
    stepsClosedBy: async () => [],
    mergedClosingPulls: async (issue) =>
      issue === expandIssue ? [expandPull] : [],
    isAncestor: async () => false,
    ...overrides,
  };
}

describe("stepsToStart", () => {
  it("starts the step a merged PR just unblocked", async () => {
    expect(await stepsToStart(expandIssue, fakeGitHub())).toEqual([260]);
  });

  it("starts nothing when the blocker closed without a merged PR", async () => {
    const gh = fakeGitHub({ mergedClosingPulls: async () => [] });
    expect(await stepsToStart(expandIssue, gh)).toEqual([]);
  });

  it("waits while another blocker is open, even one reopened after its PR merged", async () => {
    const gh = fakeGitHub({
      stepsBlockedBy: async () => [
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
    expect(await stepsToStart(expandIssue, gh)).toEqual([]);
  });

  it("starts nothing while another closed blocker has no merged PR", async () => {
    const gh = fakeGitHub({
      stepsBlockedBy: async () => [
        {
          number: 260,
          blockers: [
            { number: 265, closed: true },
            { number: 266, closed: true },
          ],
        },
      ],
    });
    expect(await stepsToStart(expandIssue, gh)).toEqual([]);
  });
});

describe("gateStatus", () => {
  it("passes a PR that closes no expand/contract step", async () => {
    expect(await gateStatus(999, "prod-sha", fakeGitHub())).toEqual({
      state: "success",
      description: "Not an expand/contract step.",
    });
  });

  it("waits while the blocker's PR is not in production", async () => {
    const gh = fakeGitHub({ stepsClosedBy: async () => [switchStep] });
    expect(await gateStatus(270, "prod-sha", gh)).toEqual({
      state: "pending",
      description: "Waiting for #261 (closes #265) in production.",
    });
  });

  it("passes once the blocker's PR is in production", async () => {
    const gh = fakeGitHub({
      stepsClosedBy: async () => [switchStep],
      isAncestor: async (commit, of) =>
        commit === "expand-merge" && of === "prod-sha",
    });
    expect(await gateStatus(270, "prod-sha", gh)).toEqual({
      state: "success",
      description: "#261 (closes #265) is in production.",
    });
  });

  it("waits while no production deploy is known", async () => {
    const gh = fakeGitHub({
      stepsClosedBy: async () => [switchStep],
      isAncestor: async () => true,
    });
    expect(await gateStatus(270, undefined, gh)).toMatchObject({
      state: "pending",
    });
  });

  it("names a blocker that has no merged PR yet", async () => {
    const gh = fakeGitHub({
      stepsClosedBy: async () => [switchStep],
      mergedClosingPulls: async () => [],
    });
    expect(await gateStatus(270, "prod-sha", gh)).toEqual({
      state: "pending",
      description: "Waiting for a merged PR closing #265 in production.",
    });
  });

  it("passes a step with no blocker to wait on", async () => {
    const gh = fakeGitHub({
      stepsClosedBy: async () => [{ number: 265, blockers: [] }],
    });
    expect(await gateStatus(261, "prod-sha", gh)).toEqual({
      state: "success",
      description: "No previous step to wait on.",
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
    });
    expect(await gateStatus(270, "prod-sha", gh)).toEqual({
      state: "pending",
      description:
        "Waiting for #261 (closes #265), #267 (closes #266) in production.",
    });
  });
});
