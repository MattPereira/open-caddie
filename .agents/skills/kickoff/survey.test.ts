import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildPicture,
  FACTORY_FORBIDDEN,
  checklistRefs,
  checksState,
  orcaInfo,
  parseStatus,
  parseWorktrees,
  type Raw,
  type RawIssue,
  type RawPr,
  type OrcaWorktree,
  type RawWorktree,
} from "./survey";

const ME = "me";

function issue(
  number: number,
  over: Partial<RawIssue> & { labelNames?: string[] } = {},
): RawIssue {
  const { labelNames = [], ...rest } = over;
  return {
    number,
    title: `issue ${number}`,
    body: "",
    labels: labelNames.map((name) => ({ name })),
    assignees: [],
    comments: [],
    ...rest,
  };
}

function pr(number: number, over: Partial<RawPr> = {}): RawPr {
  return {
    number,
    title: `pr ${number}`,
    body: "",
    author: { login: ME },
    headRefName: `agent/issue-${number}`,
    isDraft: false,
    reviewDecision: "",
    statusCheckRollup: [{ conclusion: "SUCCESS" }],
    closingIssuesReferences: [],
    comments: [],
    ...over,
  };
}

const main: RawWorktree = {
  path: "/repo",
  branch: "main",
  isMain: true,
  status: null,
  orca: null,
};

function picture(over: Partial<Raw>) {
  return buildPicture({
    repo: "o/r",
    me: ME,
    issues: [],
    prs: [],
    merged: [],
    worktrees: [main],
    warnings: [],
    ...over,
  });
}

const lane = (items: { n: number; action: string; why: string }[]) =>
  items.map(({ n, action, why }) => ({ n, action, why }));

describe("checksState", () => {
  it("is red when any check fails, even with others pending", () => {
    expect(checksState([{ conclusion: "" }, { conclusion: "FAILURE" }])).toBe(
      "red",
    );
    expect(checksState([{ state: "ERROR" }])).toBe("red");
  });

  it("is pending while a check has no conclusion", () => {
    expect(
      checksState([
        { conclusion: "SUCCESS" },
        { conclusion: "", status: "IN_PROGRESS" },
      ]),
    ).toBe("pending");
    expect(checksState([{ state: "PENDING" }])).toBe("pending");
  });

  it("is green when every check succeeded, was skipped or neutral", () => {
    expect(
      checksState([
        { conclusion: "SUCCESS" },
        { conclusion: "SKIPPED" },
        { state: "SUCCESS" },
      ]),
    ).toBe("green");
    expect(checksState([])).toBe("green");
  });
});

describe("PRs", () => {
  it("asks to fix red or changes-requested, merge approved or own, review agent PRs", () => {
    const result = picture({
      prs: [
        pr(1),
        pr(2, { statusCheckRollup: [{ conclusion: "FAILURE" }] }),
        pr(3, { reviewDecision: "APPROVED" }),
        pr(4, { headRefName: "4-mine" }),
        pr(5, { reviewDecision: "CHANGES_REQUESTED" }),
        pr(6, { isDraft: true }),
      ],
    });
    expect(lane(result.human)).toEqual([
      { n: 4, action: "merge", why: "your PR, checks green" },
      { n: 3, action: "merge", why: "agent PR, checks green" },
      { n: 5, action: "fix", why: "agent PR, changes requested" },
      { n: 2, action: "fix", why: "agent PR, checks red" },
      { n: 6, action: "review", why: "agent PR, draft" },
      { n: 1, action: "review", why: "agent PR, checks green" },
    ]);
  });

  it("folds the issue a PR closes into the PR", () => {
    const result = picture({
      issues: [issue(10, { labelNames: ["ready-for-agent"] })],
      prs: [pr(11, { closingIssuesReferences: [{ number: 10 }] })],
    });
    expect(result.agent).toEqual([]);
    expect(result.human.map((i) => i.n)).toEqual([11]);
  });

  it("drops bot comments from the detail", () => {
    const result = picture({
      prs: [
        pr(1, {
          body: "Summary <!-- hidden -->",
          comments: [
            { author: { login: ME }, body: "Standards: PASS" },
            { author: { login: "vercel" }, body: "[vc]: blob" },
            { author: { login: "renovate[bot]" }, body: "bump" },
          ],
        }),
      ],
    });
    expect(result.human[0]?.detail).toEqual({
      excerpt: "Summary",
      lastComment: "Standards: PASS",
    });
  });
});

describe("issues", () => {
  it("skips issues blocked or assigned to someone else, and lists factory runs as running", () => {
    const result = picture({
      issues: [
        issue(1, {
          labelNames: ["ready-for-agent"],
          blockedBy: { nodes: [{ number: 9, state: "OPEN" }] },
        }),
        issue(2, {
          labelNames: ["ready-for-agent"],
          blockedBy: { nodes: [{ number: 9, state: "CLOSED" }] },
        }),
        issue(3, { assignees: [{ login: "other" }] }),
        issue(4, { labelNames: ["agent:in-progress"] }),
      ],
    });
    expect(result.skipped).toEqual({ blocked: [1], assignedToOthers: [3] });
    expect(result.agent.map((i) => i.n)).toEqual([2]);
    expect(result.running).toEqual([
      { lane: "Remote Factory", n: 4, title: "issue 4" },
    ]);
  });

  it("ranks assigned, then bugs, then leverage, then momentum", () => {
    const result = picture({
      issues: [
        issue(4, { labelNames: ["ready-for-agent"] }),
        issue(2, { labelNames: ["ready-for-agent"], body: "Follows #50." }),
        issue(3, {
          labelNames: ["ready-for-agent"],
          blocking: { nodes: [{ number: 7, state: "OPEN" }] },
        }),
        issue(1, { labelNames: ["ready-for-agent", "bug"] }),
        issue(5, {
          labelNames: ["ready-for-human"],
          assignees: [{ login: ME }],
        }),
      ],
      merged: [
        { number: 51, title: "fix", closingIssuesReferences: [{ number: 50 }] },
      ],
    });
    expect(lane(result.agent)).toEqual([
      { n: 1, action: "implement", why: "bug" },
      { n: 3, action: "implement", why: "blocks #7" },
      { n: 2, action: "implement", why: "follows #51" },
      { n: 4, action: "implement", why: "ready-for-agent" },
    ]);
    expect(lane(result.human)).toEqual([
      { n: 5, action: "start", why: "assigned to you" },
    ]);
  });

  it("routes human, triage, blocked and unlabelled issues", () => {
    const result = picture({
      issues: [
        issue(1, { labelNames: ["needs-a-human"] }),
        issue(2, { labelNames: ["needs-triage"] }),
        issue(3, { labelNames: ["agent:blocked"] }),
        issue(4),
        issue(5, { blocking: { nodes: [{ number: 6, state: "OPEN" }] } }),
        issue(6, {
          labelNames: ["ready-for-agent"],
          blockedBy: { nodes: [{ number: 5, state: "OPEN" }] },
        }),
      ],
    });
    expect(lane(result.human)).toEqual([
      { n: 5, action: "triage", why: "blocks #6" },
      { n: 1, action: "start", why: "needs-a-human" },
      { n: 2, action: "triage", why: "needs-triage" },
    ]);
    expect(lane(result.agent)).toEqual([
      { n: 3, action: "explore", why: "agent:blocked" },
    ]);
    expect(result.unlabelled).toEqual([{ n: 4, title: "issue 4" }]);
  });

  it("proposes closing a tracking issue whose checklist sub-issues are all closed", () => {
    const body = "- [x] #20 one\n- [ ] #21 two\n\nMoved out: #22";
    const result = picture({
      issues: [
        issue(1, { body }),
        issue(2, { body: "- [ ] #1\n- [ ] #20" }),
        issue(22),
      ],
    });
    expect(lane(result.triage)).toEqual([
      { n: 1, action: "close", why: "all 2 checklist sub-issues closed" },
    ]);
  });
});

describe("local workers", () => {
  const worker = (
    path: string,
    over: Partial<RawWorktree> = {},
  ): RawWorktree => ({
    path,
    branch: basename(path),
    isMain: false,
    status: { upstream: "origin/x", ahead: 0, behind: 0, dirty: 0 },
    orca: { comment: "", live: true, agents: [] },
    ...over,
  });
  const basename = (path: string) => path.split("/").at(-1) ?? "";

  it("is done with an open PR, running with a live agent, gone otherwise", () => {
    const result = picture({
      issues: [1, 2, 3, 4].map((n) =>
        issue(n, { labelNames: ["local-worker"] }),
      ),
      prs: [pr(10, { closingIssuesReferences: [{ number: 1 }] })],
      worktrees: [
        main,
        worker("/wt/2-thing"),
        worker("/wt/other", {
          orca: { comment: "#3 local-worker", live: true, agents: [] },
        }),
        worker("/wt/4-dead", {
          orca: { comment: "", live: false, agents: [] },
        }),
      ],
    });
    expect(lane(result.triage)).toEqual([
      { n: 1, action: "remove local-worker", why: "worker done, PR #10" },
    ]);
    expect(result.running.map((r) => [r.lane, r.n])).toEqual([
      ["Local Workers", 2],
      ["Local Workers", 3],
    ]);
    expect(lane(result.human).filter((i) => i.n === 4)).toEqual([
      { n: 4, action: "start", why: "local worker gone" },
    ]);
  });

  it("explains each worktree's unfinished state", () => {
    const result = picture({
      prs: [pr(10, { headRefName: "with-pr" })],
      worktrees: [
        main,
        worker("/wt/with-pr", {
          status: { upstream: "origin/with-pr", ahead: 2, behind: 0, dirty: 1 },
        }),
        worker("/wt/local", {
          status: { upstream: null, ahead: 0, behind: 0, dirty: 0 },
          orca: null,
        }),
      ],
    });
    expect(
      result.worktrees.map(({ path, pr: n, why }) => ({ path, pr: n, why })),
    ).toEqual([
      {
        path: "/wt/with-pr",
        pr: 10,
        why: "1 dirty files, 2 unpushed, agent live",
      },
      { path: "/wt/local", pr: null, why: "no PR, no upstream" },
    ]);
  });
  it("routes a ready-for-agent issue that names a factory-forbidden path to a local build", () => {
    const result = picture({
      issues: [
        issue(1, {
          labelNames: ["ready-for-agent"],
          body: "Update `lint-staged.config.mjs` and `.github/actions/x.yml`.",
        }),
        issue(2, { labelNames: ["ready-for-agent"], body: "Edit src/a.ts." }),
      ],
    });
    expect(
      result.agent
        .map(({ n, action, why }) => ({ n, action, why }))
        .toSorted((a, b) => a.n - b.n),
    ).toEqual([
      {
        n: 1,
        action: "build",
        why: "edits .github/, lint-staged.config.mjs, factory can't",
      },
      { n: 2, action: "implement", why: "ready-for-agent" },
    ]);
  });
});

describe("factory-forbidden paths", () => {
  it.each([
    "implement/prompt.md",
    "implement-spec/build-prompt.md",
  ])("FACTORY_FORBIDDEN matches what %s forbids", (prompt) => {
    const text = readFileSync(
      new URL(`../../../.sandcastle/agent-workflows/${prompt}`, import.meta.url),
      "utf8",
    );
    const noEdits = text.match(/no edits to ([\s\S]+?`)\./)?.[1] ?? "";
    const untouched = [...text.matchAll(/Leave `([^`]+)` untouched/g)];
    const forbidden = [
      ...[...noEdits.matchAll(/`([^`]+)`/g)].map((m) => m[1]),
      ...untouched.map((m) => m[1]),
    ];
    expect(forbidden.toSorted()).toEqual(FACTORY_FORBIDDEN.toSorted());
  });
});

describe("parsers", () => {
  it("reads git worktree list --porcelain, first block as main", () => {
    const porcelain =
      "worktree /repo\nHEAD abc\nbranch refs/heads/main\n\nworktree /wt/x\nHEAD def\ndetached\n";
    expect(parseWorktrees(porcelain)).toEqual([
      { path: "/repo", branch: "main", isMain: true },
      { path: "/wt/x", branch: null, isMain: false },
    ]);
  });

  it("reads git status -sb", () => {
    expect(
      parseStatus("## a...origin/a [ahead 2, behind 1]\n M x\n?? y\n"),
    ).toEqual({
      upstream: "origin/a",
      ahead: 2,
      behind: 1,
      dirty: 2,
    });
    expect(parseStatus("## a\n")).toEqual({
      upstream: null,
      ahead: 0,
      behind: 0,
      dirty: 0,
    });
  });

  it("finds checklist references only", () => {
    expect(checklistRefs("- [x] #1 a\n  - [ ] #2 b\nSee #3\n* [X] #4")).toEqual(
      [1, 2, 4],
    );
  });
});

describe("orcaInfo", () => {
  const agent = { agentType: "claude", state: "done", prompt: "x".repeat(200) };

  it("is live only with an open terminal and an agent in it", () => {
    const at = (liveTerminalCount: number, agents: OrcaWorktree["agents"]) =>
      orcaInfo({ path: "/wt", liveTerminalCount, agents })?.live;
    expect([at(1, [agent]), at(0, [agent]), at(1, [])]).toEqual([
      true,
      false,
      false,
    ]);
  });

  it("keeps the comment and a short line per agent", () => {
    const info = orcaInfo({
      path: "/wt",
      comment: "#3 local-worker",
      liveTerminalCount: 1,
      agents: [agent],
    });
    expect(info).toEqual({
      comment: "#3 local-worker",
      live: true,
      agents: [`claude done: ${"x".repeat(120)}`],
    });
  });
});
