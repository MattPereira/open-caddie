// See .github/workflows/expand-contract-start.yml, expand-contract-gate.yml,
// expand-contract-update.yml and agent-review.yml.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface Step {
  number: number;
  blockers: { number: number; closed: boolean }[];
}

export interface MergedPull {
  number: number;
  mergeCommit: string;
}

export interface GitHub {
  /** Open `expand-contract` issues blocked by `issue`. */
  stepsBlockedBy(issue: number): Promise<Step[]>;
  stepsClosedBy(pull: number): Promise<Step[]>;
  mergedClosingPulls(issue: number): Promise<MergedPull[]>;
  isAncestor(commit: string, of: string): Promise<boolean>;
}

export async function stepsToStart(
  closedIssue: number,
  gh: GitHub,
): Promise<number[]> {
  const starts: number[] = [];
  for (const step of await gh.stepsBlockedBy(closedIssue)) {
    if (await blockersAllMerged(step, gh)) starts.push(step.number);
  }
  return starts;
}

export interface GateStatus {
  state: "success" | "pending";
  description: string;
}

export async function gateStatus(
  pull: number,
  prodSha: string | undefined,
  gh: GitHub,
): Promise<GateStatus> {
  const steps = await gh.stepsClosedBy(pull);
  if (steps.length === 0)
    return { state: "success", description: "Not an expand/contract step." };
  const deployed: string[] = [];
  const waiting: string[] = [];
  for (const step of steps) {
    for (const blocker of step.blockers) {
      const pulls = await gh.mergedClosingPulls(blocker.number);
      const blockerLabel =
        pulls.length === 0
          ? `a merged PR closing #${blocker.number}`
          : `${pulls.map((p) => `#${p.number}`).join(", ")} (closes #${blocker.number})`;
      const inProd = await anyPullInProd(pulls, prodSha, gh);
      (inProd ? deployed : waiting).push(blockerLabel);
    }
  }
  if (waiting.length === 0 && deployed.length === 0)
    return { state: "success", description: "No previous step to wait on." };
  if (waiting.length === 0)
    return {
      state: "success",
      description: `${deployed.join(", ")} is in production.`,
    };
  return {
    state: "pending",
    description: `Waiting for ${waiting.join(", ")} in production.`,
  };
}

async function anyPullInProd(
  pulls: MergedPull[],
  prodSha: string | undefined,
  gh: GitHub,
): Promise<boolean> {
  if (!prodSha) return false;
  for (const pull of pulls) {
    if (await gh.isAncestor(pull.mergeCommit, prodSha)) return true;
  }
  return false;
}

// Closed as "not planned" starts nothing: the gate could never pass.
async function blockersAllMerged(step: Step, gh: GitHub): Promise<boolean> {
  for (const blocker of step.blockers) {
    if (!blocker.closed) return false;
    if ((await gh.mergedClosingPulls(blocker.number)).length === 0)
      return false;
  }
  return true;
}

export interface MergeCall {
  call: "auto" | "needs-a-human";
  reason: string;
}

export interface MergeInputs {
  closesStep: boolean;
  call: MergeCall;
  findingsLeft: number;
  /** Migration files whose added lines contain DROP. */
  drops: string[];
}

export type MergeDecision =
  | { action: "none" }
  | { action: "auto-merge" }
  | { action: "needs-a-human"; reasons: string[] };

// The reviewer only makes the call; these checks decide.
export function mergeDecision(inputs: MergeInputs): MergeDecision {
  if (!inputs.closesStep) return { action: "none" };
  const reasons: string[] = [];
  if (inputs.call.call !== "auto")
    reasons.push(`The reviewer's call: ${inputs.call.reason}`);
  if (inputs.findingsLeft > 0)
    reasons.push(
      `The review left ${inputs.findingsLeft} ${inputs.findingsLeft === 1 ? "finding" : "findings"} for you.`,
    );
  for (const file of inputs.drops)
    reasons.push(
      `\`${file}\` contains \`DROP\`, which can't be rolled back (#270).`,
    );
  return reasons.length === 0
    ? { action: "auto-merge" }
    : { action: "needs-a-human", reasons };
}

const MIGRATION = /^src\/db\/migrations\/.*\.sql$/;

/** The migration files a unified diff adds a `DROP` line to. */
export function migrationDrops(diff: string): string[] {
  const drops = new Set<string>();
  let file = "";
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) file = line.replace(/^\+\+\+ b\//, "");
    else if (line.startsWith("+") && /\bDROP\b/i.test(line)) drops.add(file);
  }
  return [...drops].filter((file) => MIGRATION.test(file));
}

export interface OpenStep {
  closingPulls: { number: number; autoMerge: boolean }[];
}

export function pullsToUpdate(steps: OpenStep[]): number[] {
  const pulls = new Set<number>();
  for (const step of steps)
    for (const pull of step.closingPulls)
      if (pull.autoMerge) pulls.add(pull.number);
  return [...pulls];
}

const STEP_LABEL = "expand-contract";
const GATE_CONTEXT = "Previous step deployed";

function runGh(...args: string[]): string {
  return execFileSync("gh", args, { encoding: "utf8" }).trim();
}

function graphql<T>(
  query: string,
  variables: Record<string, string | number>,
): T {
  const fields = Object.entries(variables).flatMap(([key, value]) => [
    typeof value === "number" ? "-F" : "-f",
    `${key}=${value}`,
  ]);
  return JSON.parse(runGh("api", "graphql", "-f", `query=${query}`, ...fields))
    .data;
}

interface IssueNode {
  number: number;
  state: "OPEN" | "CLOSED";
  labels: { nodes: { name: string }[] };
  blockedBy: { nodes: { number: number; state: "OPEN" | "CLOSED" }[] };
}

const ISSUE_FIELDS = `
  number
  state
  labels(first: 50) { nodes { name } }
  blockedBy(first: 20) { nodes { number state } }
`;

function toSteps(issues: IssueNode[]): Step[] {
  return issues
    .filter((issue) => issue.labels.nodes.some((l) => l.name === STEP_LABEL))
    .map((issue) => ({
      number: issue.number,
      blockers: issue.blockedBy.nodes.map((blocker) => ({
        number: blocker.number,
        closed: blocker.state === "CLOSED",
      })),
    }));
}

function cliGitHub(repo: string): GitHub {
  const [owner, name] = repo.split("/");
  return {
    stepsBlockedBy: async (issue) => {
      const data = graphql<{
        repository: { issue: { blocking: { nodes: IssueNode[] } } };
      }>(
        `query ($owner: String!, $name: String!, $issue: Int!) {
          repository(owner: $owner, name: $name) {
            issue(number: $issue) { blocking(first: 20) { nodes { ${ISSUE_FIELDS} } } }
          }
        }`,
        { owner, name, issue },
      );
      return toSteps(
        data.repository.issue.blocking.nodes.filter((i) => i.state === "OPEN"),
      );
    },
    stepsClosedBy: async (pull) => {
      const data = graphql<{
        repository: {
          pullRequest: { closingIssuesReferences: { nodes: IssueNode[] } };
        };
      }>(
        `query ($owner: String!, $name: String!, $pull: Int!) {
          repository(owner: $owner, name: $name) {
            pullRequest(number: $pull) {
              closingIssuesReferences(first: 20) { nodes { ${ISSUE_FIELDS} } }
            }
          }
        }`,
        { owner, name, pull },
      );
      return toSteps(data.repository.pullRequest.closingIssuesReferences.nodes);
    },
    mergedClosingPulls: async (issue) => {
      const data = graphql<{
        repository: {
          issue: {
            closedByPullRequestsReferences: {
              nodes: {
                number: number;
                merged: boolean;
                mergeCommit: { oid: string } | null;
              }[];
            };
          };
        };
      }>(
        `
          query ($owner: String!, $name: String!, $issue: Int!) {
            repository(owner: $owner, name: $name) {
              issue(number: $issue) {
                closedByPullRequestsReferences(
                  first: 20
                  includeClosedPrs: true
                ) {
                  nodes {
                    number
                    merged
                    mergeCommit {
                      oid
                    }
                  }
                }
              }
            }
          }
        `,
        { owner, name, issue },
      );
      return data.repository.issue.closedByPullRequestsReferences.nodes.flatMap(
        (pull) =>
          pull.merged && pull.mergeCommit
            ? [{ number: pull.number, mergeCommit: pull.mergeCommit.oid }]
            : [],
      );
    },
    isAncestor: async (commit, of) => {
      const status = runGh(
        "api",
        `repos/${repo}/compare/${commit}...${of}`,
        "--jq",
        ".status",
      );
      return status === "identical" || status === "ahead";
    },
  };
}

interface PullHead {
  number: number;
  headSha: string;
}

function prodSha(repo: string): string | undefined {
  const deployments = JSON.parse(
    runGh(
      "api",
      `repos/${repo}/deployments?environment=Production&per_page=20`,
    ),
  ) as { id: number; sha: string }[];
  for (const deployment of deployments) {
    const state = runGh(
      "api",
      `repos/${repo}/deployments/${deployment.id}/statuses?per_page=1`,
      "--jq",
      ".[0].state",
    );
    if (state === "success") return deployment.sha;
  }
  return undefined;
}

interface OpenPull {
  number: number;
  headRefOid: string;
  autoMergeRequest: { enabledAt: string } | null;
}

function openPullsByStep(repo: string): OpenPull[][] {
  const [owner, name] = repo.split("/");
  const data = graphql<{
    repository: {
      issues: {
        nodes: { closedByPullRequestsReferences: { nodes: OpenPull[] } }[];
      };
    };
  }>(
    `
      query ($owner: String!, $name: String!, $label: String!) {
        repository(owner: $owner, name: $name) {
          issues(first: 100, states: OPEN, labels: [$label]) {
            nodes {
              closedByPullRequestsReferences(first: 20) {
                nodes {
                  number
                  headRefOid
                  autoMergeRequest {
                    enabledAt
                  }
                }
              }
            }
          }
        }
      }
    `,
    { owner, name, label: STEP_LABEL },
  );
  return data.repository.issues.nodes.map(
    (issue) => issue.closedByPullRequestsReferences.nodes,
  );
}

function openPullsClosingSteps(repo: string): PullHead[] {
  const pulls = new Map<number, string>();
  for (const step of openPullsByStep(repo))
    for (const pull of step) pulls.set(pull.number, pull.headRefOid);
  return [...pulls].map(([number, headSha]) => ({ number, headSha }));
}

const STARTED = "<!-- expand-contract:started -->";

// A step with two blockers is reached from each one's close. Not atomic: two
// closes at the same moment can both start it (expand-contract-start.yml).
function alreadyStarted(issue: number): boolean {
  const bodies = runGh(
    "issue",
    "view",
    String(issue),
    "--json",
    "comments",
    "--jq",
    ".comments[].body",
  );
  return bodies.includes(STARTED);
}

async function start(repo: string, env: NodeJS.ProcessEnv) {
  const closed = Number(env.CLOSED_ISSUE);
  if (!closed) throw new Error("CLOSED_ISSUE is required.");
  const starts = await stepsToStart(closed, cliGitHub(repo));
  if (starts.length === 0) console.log(`#${closed} unblocked no step.`);
  for (const issue of starts) {
    if (alreadyStarted(issue)) {
      console.log(`#${issue} already started.`);
      continue;
    }
    console.log(`#${closed} unblocked #${issue}.`);
    if (env.DRY_RUN) continue;
    runGh("workflow", "run", "agent-implement.yml", "-f", `issue=${issue}`);
    runGh(
      "issue",
      "comment",
      String(issue),
      "--body",
      `Unblocked: #${closed} closed. [This run](${env.RUN_URL}) started the implementer. Its PR can merge once #${closed}'s PR is in production (the \`${GATE_CONTEXT}\` check). ${STARTED} <!-- factory:status -->`,
    );
  }
}

async function gate(repo: string, env: NodeJS.ProcessEnv) {
  // Looked up even on a deploy event: deploy events can arrive out of order.
  const sha = prodSha(repo);
  const pulls = env.PULL
    ? [
        {
          number: Number(env.PULL),
          headSha: required(env.HEAD_SHA, "HEAD_SHA"),
        },
      ]
    : openPullsClosingSteps(repo);
  const gh = cliGitHub(repo);
  for (const pull of pulls) {
    const status = await gateStatus(pull.number, sha, gh);
    console.log(`#${pull.number} ${status.state}: ${status.description}`);
    if (env.DRY_RUN) continue;
    runGh(
      "api",
      `repos/${repo}/statuses/${pull.headSha}`,
      "-f",
      `state=${status.state}`,
      "-f",
      `context=${GATE_CONTEXT}`,
      // GitHub rejects a status description over 140 characters.
      "-f",
      `description=${status.description.slice(0, 140)}`,
      "-f",
      `target_url=${env.RUN_URL}`,
    );
  }
}

const MERGE_CHECKS = "`Merge gate` and `Previous step deployed`";

async function merge(repo: string, env: NodeJS.ProcessEnv) {
  const pull = required(env.PULL, "PULL");
  const review = JSON.parse(
    readFileSync(required(env.MERGE_FILE, "MERGE_FILE"), "utf8"),
  ) as { merge: MergeCall; findingsLeft: number };
  const diff = execFileSync(
    "git",
    ["diff", `origin/${required(env.BASE_REF, "BASE_REF")}...HEAD`],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const decision = mergeDecision({
    closesStep: (await cliGitHub(repo).stepsClosedBy(Number(pull))).length > 0,
    call: review.merge,
    findingsLeft: review.findingsLeft,
    drops: migrationDrops(diff),
  });
  console.log(`#${pull}: ${JSON.stringify(decision)}`);
  if (env.DRY_RUN || decision.action === "none") return;
  if (decision.action === "auto-merge") {
    runGh("pr", "merge", pull, "--auto", "--squash");
    runGh(
      "pr",
      "comment",
      pull,
      "--body",
      `Auto-merge is on: the review was clean. It merges once ${MERGE_CHECKS} pass. Reviewer: ${review.merge.reason} <!-- factory:status -->`,
    );
    return;
  }
  // A re-review can find what an earlier one missed.
  try {
    runGh("pr", "merge", pull, "--disable-auto");
  } catch {
    console.log(`#${pull} had no auto-merge to turn off.`);
  }
  runGh(
    "pr",
    "comment",
    pull,
    "--body",
    [
      "This expand/contract step needs a human to merge it:",
      "",
      ...decision.reasons.map((reason) => `- ${reason}`),
      "",
      `Merge it yourself once ${MERGE_CHECKS} pass. <!-- factory:status -->`,
    ].join("\n"),
  );
}

// `protect main` requires up-to-date branches, and auto-merge won't update
// them. A merge, not a rebase, so the reviewed commits keep their SHAs.
async function update(repo: string, env: NodeJS.ProcessEnv) {
  const pulls = pullsToUpdate(
    openPullsByStep(repo).map((pulls) => ({
      closingPulls: pulls.map((pull) => ({
        number: pull.number,
        autoMerge: pull.autoMergeRequest !== null,
      })),
    })),
  );
  if (pulls.length === 0) console.log("No auto-merge step PR to update.");
  let failed = false;
  for (const pull of pulls) {
    console.log(`Updating #${pull} from main.`);
    if (env.DRY_RUN) continue;
    try {
      runGh("pr", "update-branch", String(pull));
    } catch (error) {
      failed = true;
      console.error(`::error::#${pull} could not be updated: ${error}`);
    }
  }
  if (failed) process.exitCode = 1;
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function main() {
  const repo = process.env.GH_REPO;
  if (!repo) throw new Error("GH_REPO is required.");
  const mode = process.argv[2];
  if (mode === "start") await start(repo, process.env);
  else if (mode === "gate") await gate(repo, process.env);
  else if (mode === "merge") await merge(repo, process.env);
  else if (mode === "update") await update(repo, process.env);
  else
    throw new Error(
      `Usage: expand-contract.ts start|gate|merge|update, got ${mode}.`,
    );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
