// See .github/workflows/start-unblocked-steps.yml.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export interface AwaitingStep {
  number: number;
  blockers: number[];
}

export interface MergedPull {
  number: number;
  mergeCommit: string;
}

export interface GitHub {
  awaitingDeploy(): Promise<AwaitingStep[]>;
  mergedClosingPulls(issue: number): Promise<MergedPull[]>;
  isAncestor(commit: string, of: string): Promise<boolean>;
}

export interface Start {
  issue: number;
  pulls: number[];
}

export async function stepsToStart(
  deployedSha: string,
  gh: GitHub,
): Promise<Start[]> {
  const starts: Start[] = [];
  for (const step of await gh.awaitingDeploy()) {
    if (step.blockers.length === 0) continue;
    const pulls: number[] = [];
    for (const blocker of step.blockers) {
      const pull = await findDeployed(blocker, deployedSha, gh);
      if (!pull) break;
      pulls.push(pull.number);
    }
    if (pulls.length === step.blockers.length)
      starts.push({ issue: step.number, pulls });
  }
  return starts;
}

// Ancestry, not "a deploy succeeded": promoting an older deployment must not
// start the step.
async function findDeployed(
  blocker: number,
  deployedSha: string,
  gh: GitHub,
): Promise<MergedPull | undefined> {
  for (const pull of await gh.mergedClosingPulls(blocker)) {
    if (await gh.isAncestor(pull.mergeCommit, deployedSha)) return pull;
  }
  return undefined;
}

const AWAITS_DEPLOY = "awaits-deploy";

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

function cliGitHub(repo: string): GitHub {
  const [owner, name] = repo.split("/");
  return {
    awaitingDeploy: async () => {
      const data = graphql<{
        repository: {
          issues: {
            nodes: {
              number: number;
              blockedBy: { nodes: { number: number }[] };
            }[];
          };
        };
      }>(
        `
          query ($owner: String!, $name: String!, $label: String!) {
            repository(owner: $owner, name: $name) {
              issues(first: 100, states: OPEN, labels: [$label]) {
                nodes {
                  number
                  blockedBy(first: 20) {
                    nodes {
                      number
                    }
                  }
                }
              }
            }
          }
        `,
        { owner, name, label: AWAITS_DEPLOY },
      );
      return data.repository.issues.nodes.map((issue) => ({
        number: issue.number,
        blockers: issue.blockedBy.nodes.map((blocker) => blocker.number),
      }));
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

async function main() {
  const { GH_REPO, DEPLOYED_SHA, DEPLOY_URL, RUN_URL, DRY_RUN } = process.env;
  if (!GH_REPO || !DEPLOYED_SHA)
    throw new Error("GH_REPO and DEPLOYED_SHA are required.");

  const starts = await stepsToStart(DEPLOYED_SHA, cliGitHub(GH_REPO));
  if (starts.length === 0) console.log(`No step waits on ${DEPLOYED_SHA}.`);
  for (const { issue, pulls } of starts) {
    const deployed = pulls.map((pull) => `#${pull}`).join(", ");
    console.log(`#${issue}: ${deployed} in ${DEPLOYED_SHA}.`);
    if (DRY_RUN) continue;
    runGh("workflow", "run", "agent-implement.yml", "-f", `issue=${issue}`);
    // Off once started, so later deploys skip it.
    runGh("issue", "edit", String(issue), "--remove-label", AWAITS_DEPLOY);
    const deploy = DEPLOY_URL
      ? `[production deploy](${DEPLOY_URL})`
      : "production deploy";
    runGh(
      "issue",
      "comment",
      String(issue),
      "--body",
      `Unblocked: the ${deploy} of ${DEPLOYED_SHA} contains ${deployed}. [This run](${RUN_URL}) started the implementer. <!-- factory:status -->`,
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
