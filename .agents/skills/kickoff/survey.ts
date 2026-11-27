#!/usr/bin/env node
// Kickoff's survey: fetches GitHub, git and Orca in parallel and prints the
// derived picture as JSON, so the agent spends its tokens on judgement only.
// Runs on Node's type stripping: no imports of other .ts files, no enums.
//   node .agents/skills/kickoff/survey.ts [--pretty]
//   node .agents/skills/kickoff/survey.ts bodies <n>...
import { execFile } from "node:child_process";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

type Login = { login: string };
type Comment = { author: Login | null; body: string };
type Nodes = { nodes?: { number: number; state: string }[] } | null;

export type RawIssue = {
  number: number;
  title: string;
  body: string;
  labels: { name: string }[];
  assignees: Login[];
  blockedBy?: Nodes;
  blocking?: Nodes;
  comments: Comment[];
};

export type RawPr = {
  number: number;
  title: string;
  body: string;
  author: Login;
  headRefName: string;
  isDraft: boolean;
  reviewDecision: string;
  statusCheckRollup: { conclusion?: string; state?: string; status?: string }[];
  closingIssuesReferences: { number: number }[];
  comments: Comment[];
};

export type RawMerged = {
  number: number;
  title: string;
  closingIssuesReferences: { number: number }[];
};

export type RawWorktree = {
  path: string;
  branch: string | null;
  isMain: boolean;
  status: GitStatus | null;
  orca: { comment: string; live: boolean; agents: string[] } | null;
};

export type GitStatus = {
  upstream: string | null;
  ahead: number;
  behind: number;
  dirty: number;
};

export type Raw = {
  repo: string;
  me: string;
  issues: RawIssue[];
  prs: RawPr[];
  merged: RawMerged[];
  worktrees: RawWorktree[];
  warnings: string[];
};

type Detail = { excerpt: string; lastComment?: string };

export type Item = {
  n: number;
  title: string;
  action: string;
  why: string;
  rank: number;
  detail?: Detail;
};

export type Picture = {
  repo: string;
  me: string;
  human: Item[];
  agent: Item[];
  triage: Item[];
  running: {
    lane: "Remote Factory" | "Local Workers";
    n: number;
    title: string;
  }[];
  worktrees: (Omit<RawWorktree, "isMain" | "orca"> & {
    pr: number | null;
    agents: string[];
    why: string;
  })[];
  unlabelled: { n: number; title: string }[];
  skipped: { blocked: number[]; assignedToOthers: number[] };
  warnings: string[];
};

const DETAIL_LIMIT = 5;
const EXCERPT_CHARS = 600;
const COMMENT_CHARS = 400;
const BOTS = new Set(["vercel", "github-actions"]);
const BUG_LABELS = ["live-bug-report", "bug"];
const HUMAN_LABELS = ["ready-for-human", "needs-a-human"];
// What the implement prompts in .sandcastle/agent-workflows forbid the factory
// to edit. survey.test.ts fails when this drifts from them.
export const FACTORY_FORBIDDEN = [
  ".github/",
  ".husky/",
  "lint-staged.config.mjs",
  "core.hooksPath",
];
const RED = new Set([
  "FAILURE",
  "ERROR",
  "TIMED_OUT",
  "CANCELLED",
  "ACTION_REQUIRED",
  "STARTUP_FAILURE",
]);
const DONE_CONCLUSIONS = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);

export function checksState(rollup: RawPr["statusCheckRollup"]) {
  let pending = false;
  for (const check of rollup) {
    const result = check.conclusion || check.state || "";
    if (RED.has(result)) return "red";
    if (!DONE_CONCLUSIONS.has(result)) pending = true;
  }
  return pending ? "pending" : "green";
}

export function prAction(pr: RawPr, me: string) {
  const checks = checksState(pr.statusCheckRollup);
  const byAgent = pr.headRefName.startsWith("agent/");
  const who = byAgent ? "agent PR" : pr.author.login === me ? "your PR" : "PR";
  const state = pr.isDraft ? "draft" : `checks ${checks}`;
  const why = `${who}, ${state}`;
  if (checks === "red") return { action: "fix", why, order: 1 };
  if (pr.reviewDecision === "CHANGES_REQUESTED")
    return { action: "fix", why: `${who}, changes requested`, order: 1 };
  if (pr.reviewDecision === "APPROVED" || (!byAgent && pr.author.login === me))
    return { action: "merge", why, order: 0 };
  return { action: "review", why, order: 2 };
}

export function parseWorktrees(porcelain: string) {
  return porcelain
    .trim()
    .split(/\n\s*\n/)
    .map((block, index) => {
      const lines = block.split("\n");
      const path = lines.find((l) => l.startsWith("worktree "))?.slice(9) ?? "";
      const ref = lines.find((l) => l.startsWith("branch "))?.slice(7);
      return {
        path,
        branch: ref ? ref.replace("refs/heads/", "") : null,
        isMain: index === 0,
      };
    })
    .filter((w) => w.path);
}

export function parseStatus(output: string): GitStatus {
  const [head = "", ...files] = output.split("\n").filter(Boolean);
  const upstream = head.match(/\.\.\.(\S+)/)?.[1] ?? null;
  return {
    upstream,
    ahead: Number(head.match(/ahead (\d+)/)?.[1] ?? 0),
    behind: Number(head.match(/behind (\d+)/)?.[1] ?? 0),
    dirty: files.length,
  };
}

function clean(text: string) {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function clip(text: string, chars: number) {
  const cleaned = clean(text);
  return cleaned.length > chars ? `${cleaned.slice(0, chars)}…` : cleaned;
}

function humanComments(comments: Comment[]) {
  return comments.filter(
    (c) =>
      c.author &&
      !BOTS.has(c.author.login) &&
      !c.author.login.endsWith("[bot]"),
  );
}

function detail(body: string, comments: Comment[]): Detail {
  const last = humanComments(comments).at(-1);
  return {
    excerpt: clip(body, EXCERPT_CHARS),
    ...(last && { lastComment: clip(last.body, COMMENT_CHARS) }),
  };
}

function refs(text: string) {
  return [...text.matchAll(/#(\d+)\b/g)].map((m) => Number(m[1]));
}

// A tracking issue lists its sub-issues as `- [ ] #n` checklist lines.
export function checklistRefs(body: string) {
  return [...body.matchAll(/^\s*[-*] \[[ xX]\] #(\d+)/gm)].map((m) =>
    Number(m[1]),
  );
}

function openNumbers(nodes: Nodes | undefined) {
  return (nodes?.nodes ?? [])
    .filter((n) => n.state === "OPEN")
    .map((n) => n.number);
}

function worktreeFor(issue: number, worktrees: RawWorktree[]) {
  return worktrees.find(
    (w) =>
      !w.isMain &&
      (basename(w.path).startsWith(`${issue}-`) ||
        w.branch?.startsWith(`${issue}-`) ||
        new RegExp(`#${issue}\\b`).test(w.orca?.comment ?? "")),
  );
}

function byRank(a: Item & { order?: number }, b: Item & { order?: number }) {
  return a.rank - b.rank || (a.order ?? 0) - (b.order ?? 0) || b.n - a.n;
}

function withDetails(
  items: Item[],
  details: Map<number, Detail>,
  limit: number,
) {
  return items.map((item, index) =>
    index < limit ? { ...item, detail: details.get(item.n) } : item,
  );
}

export function buildPicture(raw: Raw): Picture {
  const { me, issues, prs, merged, worktrees } = raw;
  const openIssues = new Set(issues.map((i) => i.number));
  const prForIssue = new Map<number, number>();
  for (const pr of prs)
    for (const ref of pr.closingIssuesReferences)
      prForIssue.set(ref.number, pr.number);
  // A merged PR, or an issue it closed, points at that PR.
  const mergedVia = new Map<number, number>();
  for (const pr of merged) {
    mergedVia.set(pr.number, pr.number);
    for (const ref of pr.closingIssuesReferences)
      mergedVia.set(ref.number, pr.number);
  }

  const details = new Map<number, Detail>();
  const human: (Item & { order?: number })[] = [];
  const agent: Item[] = [];
  const triage: Item[] = [];
  const running: Picture["running"] = [];
  const unlabelled: Picture["unlabelled"] = [];
  const skipped: Picture["skipped"] = { blocked: [], assignedToOthers: [] };

  for (const pr of prs) {
    details.set(pr.number, detail(pr.body, pr.comments));
    human.push({ n: pr.number, title: pr.title, rank: 1, ...prAction(pr, me) });
  }

  for (const issue of issues) {
    const { number: n, title } = issue;
    const labels = issue.labels.map((l) => l.name);
    const has = (label: string) => labels.includes(label);
    const assignees = issue.assignees.map((a) => a.login);
    const openPr = prForIssue.get(n);
    details.set(n, detail(issue.body, issue.comments));

    if (has("local-worker")) {
      const worktree = worktreeFor(n, worktrees);
      if (openPr) {
        triage.push({
          n,
          title,
          rank: 1,
          action: "remove local-worker",
          why: `worker done, PR #${openPr}`,
        });
      } else if (worktree?.orca?.live) {
        running.push({ lane: "Local Workers", n, title });
      } else {
        human.push({
          n,
          title,
          rank: 1,
          action: "start",
          why: "local worker gone",
          order: 3,
        });
      }
      continue;
    }
    if (openPr) continue;
    if (has("agent:in-progress")) {
      running.push({ lane: "Remote Factory", n, title });
      continue;
    }
    if (assignees.length > 0 && !assignees.includes(me)) {
      skipped.assignedToOthers.push(n);
      continue;
    }
    const blockers = openNumbers(issue.blockedBy);
    if (blockers.length > 0) {
      skipped.blocked.push(n);
      continue;
    }
    const subIssues = checklistRefs(issue.body);
    if (subIssues.length >= 2 && subIssues.every((s) => !openIssues.has(s))) {
      triage.push({
        n,
        title,
        rank: 1,
        action: "close",
        why: `all ${subIssues.length} checklist sub-issues closed`,
      });
      continue;
    }

    const blocking = openNumbers(issue.blocking);
    const follows = [
      ...new Set(
        refs(issue.body)
          .map((r) => mergedVia.get(r))
          .filter((r) => r !== undefined),
      ),
    ];
    const bug = BUG_LABELS.find(has);
    const [rank, why] = assignees.includes(me)
      ? [1, "assigned to you"]
      : bug
        ? [2, bug]
        : blocking.length > 0
          ? [3, `blocks ${blocking.map((b) => `#${b}`).join(", ")}`]
          : follows.length > 0
            ? [4, `follows ${follows.map((f) => `#${f}`).join(", ")}`]
            : [5, ""];
    // PRs order 0-2, so within a rank they come before issues.
    const item = (action: string, fallback: string) => ({
      n,
      title,
      rank,
      action,
      why: why || fallback,
      order: 3,
    });

    const humanLabel = HUMAN_LABELS.find(has);
    if (assignees.includes(me) || humanLabel)
      human.push(item("start", humanLabel ?? ""));
    else if (has("needs-triage"))
      human.push({ ...item("triage", "needs-triage"), order: 4 });
    else if (has("ready-for-agent")) {
      const forbidden = FACTORY_FORBIDDEN.filter((p) => issue.body.includes(p));
      agent.push(
        stripOrder(
          forbidden.length > 0
            ? {
                ...item("build", ""),
                why: `edits ${forbidden.join(", ")}, factory can't`,
              }
            : item("implement", "ready-for-agent"),
        ),
      );
    }
    else if (has("agent:blocked"))
      agent.push(stripOrder(item("explore", "agent:blocked")));
    else if (rank <= 3) human.push(item("triage", ""));
    else unlabelled.push({ n, title });
  }

  const branchPr = new Map(prs.map((pr) => [pr.headRefName, pr.number]));
  const pictureWorktrees = worktrees
    .filter((w) => !w.isMain)
    .map(({ isMain: _main, orca, ...w }) => {
      const pr = (w.branch && branchPr.get(w.branch)) || null;
      const reasons = [
        !pr && "no PR",
        w.status?.dirty && `${w.status.dirty} dirty files`,
        w.status?.ahead && `${w.status.ahead} unpushed`,
        w.status && !w.status.upstream && "no upstream",
        orca?.live && "agent live",
      ].filter(Boolean);
      return { ...w, pr, agents: orca?.agents ?? [], why: reasons.join(", ") };
    });

  return {
    repo: raw.repo,
    me,
    human: withDetails(human.sort(byRank), details, DETAIL_LIMIT).map(
      stripOrder,
    ),
    agent: withDetails(agent.sort(byRank), details, DETAIL_LIMIT),
    triage: withDetails(triage, details, triage.length),
    running,
    worktrees: pictureWorktrees,
    unlabelled,
    skipped,
    warnings: raw.warnings,
  };
}

function stripOrder({
  order: _order,
  ...item
}: Item & { order?: number }): Item {
  return item;
}

const exec = promisify(execFile);

async function run(cmd: string, args: string[], cwd?: string) {
  const { stdout } = await exec(cmd, args, {
    cwd,
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout;
}

async function json<T>(cmd: string, args: string[]): Promise<T> {
  return JSON.parse(await run(cmd, args)) as T;
}

export type OrcaWorktree = {
  path: string;
  comment?: string;
  liveTerminalCount: number;
  agents: { agentType: string; state: string; prompt?: string }[];
};

type OrcaPs = { result: { worktrees: OrcaWorktree[] } };

// "done" agents are idle at their prompt, still live; a live worker needs both
// an open terminal and an agent in it.
export function orcaInfo(o: OrcaWorktree): RawWorktree["orca"] {
  return {
    comment: o.comment ?? "",
    live: o.liveTerminalCount > 0 && o.agents.length > 0,
    agents: o.agents.map(
      (a) => `${a.agentType} ${a.state}: ${(a.prompt ?? "").slice(0, 120)}`,
    ),
  };
}

async function orcaWorktrees(warnings: string[]) {
  try {
    const ps = await json<OrcaPs>("orca", [
      "worktree",
      "ps",
      "--json",
      "--limit",
      "500",
    ]);
    return ps.result.worktrees;
  } catch (error) {
    warnings.push(
      `orca worktree ps failed: ${(error as Error).message.split("\n")[0]}`,
    );
    return [];
  }
}

async function gitStatus(path: string) {
  try {
    return parseStatus(await run("git", ["-C", path, "status", "-sb"]));
  } catch {
    return null;
  }
}

async function fetchRaw(): Promise<Raw> {
  const warnings: string[] = [];
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const [repo, me, issues, prs, merged, porcelain, orca] = await Promise.all([
    run("gh", [
      "repo",
      "view",
      "--json",
      "nameWithOwner",
      "-q",
      ".nameWithOwner",
    ]),
    run("gh", ["api", "user", "-q", ".login"]),
    json<RawIssue[]>("gh", [
      "issue",
      "list",
      "--state",
      "open",
      "--limit",
      "200",
      "--json",
      "number,title,body,labels,assignees,blockedBy,blocking,comments",
    ]),
    json<RawPr[]>("gh", [
      "pr",
      "list",
      "--state",
      "open",
      "--json",
      "number,title,body,author,headRefName,isDraft,reviewDecision,statusCheckRollup,closingIssuesReferences,comments",
    ]),
    json<RawMerged[]>("gh", [
      "pr",
      "list",
      "--state",
      "merged",
      "--search",
      `merged:>=${since}`,
      "--limit",
      "100",
      "--json",
      "number,title,closingIssuesReferences",
    ]),
    run("git", ["worktree", "list", "--porcelain"]),
    orcaWorktrees(warnings),
  ]);
  const worktrees = await Promise.all(
    parseWorktrees(porcelain).map(async (w) => {
      const o = orca.find((ow) => ow.path === w.path);
      return {
        ...w,
        status: w.isMain ? null : await gitStatus(w.path),
        orca: o ? orcaInfo(o) : null,
      };
    }),
  );
  return {
    repo: repo.trim(),
    me: me.trim(),
    issues,
    prs,
    merged,
    worktrees,
    warnings,
  };
}

async function bodies(numbers: string[]) {
  const fields = "number,title,state,labels,body,comments";
  return Promise.all(
    numbers.map(async (n) => {
      const item = await json<RawIssue & { state: string }>("gh", [
        "issue",
        "view",
        n,
        "--json",
        fields,
      ]).catch(() =>
        json<RawIssue & { state: string }>("gh", [
          "pr",
          "view",
          n,
          "--json",
          fields,
        ]),
      );
      return {
        n: item.number,
        title: item.title,
        state: item.state,
        labels: item.labels.map((l) => l.name),
        body: clean(item.body),
        comments: humanComments(item.comments).map(
          (c) => `${c.author?.login}: ${clean(c.body)}`,
        ),
      };
    }),
  );
}

async function main() {
  const [mode, ...rest] = process.argv.slice(2);
  const indent =
    rest.includes("--pretty") || mode === "--pretty" ? 1 : undefined;
  const output =
    mode === "bodies"
      ? await bodies(rest.filter((a) => !a.startsWith("--")))
      : buildPicture(await fetchRaw());
  console.log(JSON.stringify(output, null, indent));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
