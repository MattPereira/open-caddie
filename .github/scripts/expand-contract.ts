// See .github/workflows/expand-contract.yml, agent-review.yml and ci.yml.
import { fileURLToPath } from "node:url";
import {
  closingPulls,
  cliGitHub,
  type GitHub,
  type MergedPull,
  required,
  runGh,
  POLL_MS,
  sleep,
  type Step,
} from "./expand-contract-github.ts";
import { merge } from "./expand-contract-merge.ts";

// Every open step, not just the ones this deploy's push touched: a deploy
// that failed or was skipped is caught up by the next one that succeeds.
export async function stepsToStart(
  deployedSha: string,
  gh: GitHub,
): Promise<number[]> {
  const starts: number[] = [];
  for (const step of await gh.openSteps()) {
    if (step.blockers.length === 0) continue;
    if (await blockersDeployed(step, deployedSha, gh)) starts.push(step.number);
  }
  return starts;
}

// Closed as "not planned" starts nothing: it has no merged PR to deploy.
async function blockersDeployed(
  step: Step,
  deployedSha: string,
  gh: GitHub,
): Promise<boolean> {
  for (const blocker of step.blockers) {
    if (!blocker.closed) return false;
    const pulls = await gh.mergedClosingPulls(blocker.number);
    if (!(await anyPullInProd(pulls, deployedSha, gh))) return false;
  }
  return true;
}

export interface Readiness {
  ready: boolean;
  description: string;
}

export async function previousStepsDeployed(
  pull: number,
  prodSha: string | undefined,
  gh: GitHub,
): Promise<Readiness> {
  const steps = await gh.stepsClosedBy(pull);
  if (steps.length === 0)
    return { ready: true, description: "Not an expand/contract step." };
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
    return { ready: true, description: "No previous step to wait on." };
  if (waiting.length === 0)
    return {
      ready: true,
      description: `${deployed.join(", ")} is in production.`,
    };
  return {
    ready: false,
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

interface Deployment {
  id: number;
  sha: string;
}

function productionDeployments(repo: string, sha?: string): Deployment[] {
  const query = sha ? `&sha=${sha}` : "";
  return JSON.parse(
    runGh(
      "api",
      `repos/${repo}/deployments?environment=Production&per_page=20${query}`,
    ),
  ) as Deployment[];
}

/** Newest first. */
function deploymentStates(repo: string, id: number): string[] {
  return JSON.parse(
    runGh(
      "api",
      `repos/${repo}/deployments/${id}/statuses`,
      "--jq",
      "[.[].state]",
    ),
  ) as string[];
}

/** The newest `Production` deployment whose latest status is success. */
function prodSha(repo: string): string | undefined {
  for (const deployment of productionDeployments(repo)) {
    if (deploymentStates(repo, deployment.id)[0] === "success")
      return deployment.sha;
  }
  return undefined;
}

async function waitForDeploy(
  repo: string,
  sha: string,
  deadline: number,
): Promise<"success" | "failure" | "timed-out"> {
  while (Date.now() < deadline) {
    const histories = productionDeployments(repo, sha).map((d) =>
      deploymentStates(repo, d.id),
    );
    // Any success, not the latest: a newer deploy marks this one `inactive`.
    if (histories.some((states) => states.includes("success")))
      return "success";
    // A redeploy of the same commit can still succeed; a failure with
    // nothing else in flight is final.
    if (
      histories.length > 0 &&
      histories.every(([latest]) => latest === "failure" || latest === "error")
    )
      return "failure";
    await sleep(POLL_MS);
  }
  return "timed-out";
}

const STARTED = "<!-- expand-contract:started -->";

// Covers a step started by hand, which carries no marker but has a PR.
function alreadyStarted(repo: string, issue: number): boolean {
  const bodies = runGh(
    "issue",
    "view",
    String(issue),
    "--json",
    "comments",
    "--jq",
    ".comments[].body",
  );
  return bodies.includes(STARTED) || closingPulls(repo, issue).length > 0;
}

const DEPLOY_WAIT_MINUTES = 30;

async function start(repo: string, env: NodeJS.ProcessEnv) {
  let sha = env.SHA;
  if (sha) {
    const deploy = await waitForDeploy(
      repo,
      sha,
      Date.now() + DEPLOY_WAIT_MINUTES * 60_000,
    );
    if (deploy === "failure") {
      console.log(
        `${sha}'s production deploy failed; the next successful one starts what it would have.`,
      );
      return;
    }
    if (deploy === "timed-out") {
      console.log(
        `::warning::No successful production deploy of ${sha} within ${DEPLOY_WAIT_MINUTES} minutes. The next one, or a dispatch of this workflow, starts what it would have.`,
      );
      return;
    }
  } else {
    sha = prodSha(repo);
    if (!sha) throw new Error("No successful production deploy found.");
  }
  const starts = await stepsToStart(sha, cliGitHub(repo));
  if (starts.length === 0) console.log(`${sha} unblocked no step.`);
  for (const issue of starts) {
    if (alreadyStarted(repo, issue)) {
      console.log(`#${issue} already started.`);
      continue;
    }
    console.log(`${sha} unblocked #${issue}.`);
    if (env.DRY_RUN) continue;
    runGh("workflow", "run", "agent-implement.yml", "-f", `issue=${issue}`);
    runGh(
      "issue",
      "comment",
      String(issue),
      "--body",
      `Unblocked: the previous step is in production (${sha.slice(0, 7)}). [This run](${env.RUN_URL}) started the implementer. ${STARTED} <!-- factory:status -->`,
    );
  }
}

async function check(repo: string, env: NodeJS.ProcessEnv) {
  const pull = Number(required(env.PULL, "PULL"));
  const readiness = await previousStepsDeployed(
    pull,
    prodSha(repo),
    cliGitHub(repo),
  );
  if (readiness.ready) {
    console.log(readiness.description);
    return;
  }
  console.log(`::error::${readiness.description} Re-run this job once it is.`);
  process.exitCode = 1;
}

async function main() {
  const repo = process.env.GH_REPO;
  if (!repo) throw new Error("GH_REPO is required.");
  const mode = process.argv[2];
  if (mode === "start") await start(repo, process.env);
  else if (mode === "check") await check(repo, process.env);
  else if (mode === "merge") await merge(repo, process.env);
  else
    throw new Error(
      `Usage: expand-contract.ts start|check|merge, got ${mode}.`,
    );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
