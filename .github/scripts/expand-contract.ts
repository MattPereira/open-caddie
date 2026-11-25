// See .github/workflows/expand-contract-start.yml and expand-contract-gate.yml.
import { execFileSync } from "node:child_process";
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
  /** `expand-contract` issues `pull` closes. */
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
    if (await allMerged(step, gh)) starts.push(step.number);
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
      const named =
        pulls.length === 0
          ? `a merged PR closing #${blocker.number}`
          : `${pulls.map((p) => `#${p.number}`).join(", ")} (closes #${blocker.number})`;
      const inProd = await someInProd(pulls, prodSha, gh);
      (inProd ? deployed : waiting).push(named);
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

// Ancestry, not "a deploy succeeded": promoting an older deployment must not
// let the next step merge.
async function someInProd(
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
async function allMerged(step: Step, gh: GitHub): Promise<boolean> {
  for (const blocker of step.blockers) {
    if (!blocker.closed) return false;
    if ((await gh.mergedClosingPulls(blocker.number)).length === 0)
      return false;
  }
  return true;
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

// The commit of the newest Production deployment whose latest status is
// success. Blind to a Vercel instant rollback, which records no deployment.
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

// Open PRs that close an open `expand-contract` issue.
function gatedPulls(repo: string): { number: number; headSha: string }[] {
  const [owner, name] = repo.split("/");
  const data = graphql<{
    repository: {
      issues: {
        nodes: {
          closedByPullRequestsReferences: {
            nodes: { number: number; headRefOid: string }[];
          };
        }[];
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
                }
              }
            }
          }
        }
      }
    `,
    { owner, name, label: STEP_LABEL },
  );
  const pulls = new Map<number, string>();
  for (const issue of data.repository.issues.nodes)
    for (const pull of issue.closedByPullRequestsReferences.nodes)
      pulls.set(pull.number, pull.headRefOid);
  return [...pulls].map(([number, headSha]) => ({ number, headSha }));
}

const STARTED = "<!-- expand-contract:started -->";

// The workflow's concurrency group runs one close at a time, so a second
// close sees the first one's comment.
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
  const sha = env.PROD_SHA || prodSha(repo);
  const pulls = env.PULL
    ? [{ number: Number(env.PULL), headSha: env.HEAD_SHA ?? "" }]
    : gatedPulls(repo);
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

async function main() {
  const repo = process.env.GH_REPO;
  if (!repo) throw new Error("GH_REPO is required.");
  const mode = process.argv[2];
  if (mode === "start") await start(repo, process.env);
  else if (mode === "gate") await gate(repo, process.env);
  else throw new Error(`Usage: expand-contract.ts start|gate, got ${mode}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
