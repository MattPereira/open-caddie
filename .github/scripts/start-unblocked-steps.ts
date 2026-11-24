// See .github/workflows/start-unblocked-steps.yml.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export interface Issue {
  number: number;
  body: string;
}

export interface MergedPull {
  number: number;
  body: string;
  mergeCommit: string;
}

export interface GitHub {
  openIssues(): Promise<Issue[]>;
  mergedPullsMentioning(issue: number): Promise<MergedPull[]>;
  isAncestor(commit: string, of: string): Promise<boolean>;
  alreadyStarted(issue: number): Promise<boolean>;
}

export interface Start {
  issue: number;
  blocker: number;
  pull: number;
}

// The first line the database-migrations skill gives each follow-up step.
const BLOCKER_LINE = /^Start once the production deploy of #(\d+) succeeded\./;

// GitHub's closing keywords, plus "Part of" for one step of a multi-step issue.
const LINK_KEYWORDS = "part of|close[sd]?|fix(?:e[sd])?|resolve[sd]?";

const STARTED_MARKER = "<!-- factory:deploy-unblocked -->";

function links(pull: MergedPull, issue: number): boolean {
  return new RegExp(`\\b(?:${LINK_KEYWORDS}):?\\s+#${issue}\\b`, "i").test(
    pull.body,
  );
}

export async function stepsToStart(
  deployedSha: string,
  gh: GitHub,
): Promise<Start[]> {
  const starts: Start[] = [];
  for (const issue of await gh.openIssues()) {
    const match = BLOCKER_LINE.exec(issue.body);
    if (!match) continue;
    const blocker = Number(match[1]);
    // Ancestry, not "a deploy succeeded": promoting an older deployment must
    // not start the step.
    const pull = await findDeployed(blocker, deployedSha, gh);
    if (!pull) continue;
    if (await gh.alreadyStarted(issue.number)) continue;
    starts.push({ issue: issue.number, blocker, pull: pull.number });
  }
  return starts;
}

async function findDeployed(
  blocker: number,
  deployedSha: string,
  gh: GitHub,
): Promise<MergedPull | undefined> {
  for (const pull of await gh.mergedPullsMentioning(blocker)) {
    if (
      links(pull, blocker) &&
      (await gh.isAncestor(pull.mergeCommit, deployedSha))
    ) {
      return pull;
    }
  }
  return undefined;
}

function runGh(...args: string[]): string {
  return execFileSync("gh", args, { encoding: "utf8" }).trim();
}

function cliGitHub(repo: string): GitHub {
  return {
    openIssues: async () =>
      JSON.parse(
        runGh(
          "issue",
          "list",
          "--state",
          "open",
          "--limit",
          "1000",
          "--json",
          "number,body",
        ),
      ),
    mergedPullsMentioning: async (issue) => {
      const numbers = runGh(
        "api",
        "--paginate",
        `repos/${repo}/issues/${issue}/timeline`,
        "--jq",
        `.[] | select(.event == "cross-referenced" and .source.issue.pull_request.merged_at != null and .source.issue.repository.full_name == "${repo}") | .source.issue.number`,
      )
        .split("\n")
        .filter(Boolean);
      return [...new Set(numbers)].map((number) => {
        const pull = JSON.parse(
          runGh("pr", "view", number, "--json", "number,body,mergeCommit"),
        );
        return {
          number: pull.number,
          body: pull.body,
          mergeCommit: pull.mergeCommit.oid,
        };
      });
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
    alreadyStarted: async (issue) =>
      runGh(
        "issue",
        "view",
        String(issue),
        "--json",
        "comments",
        "--jq",
        `any(.comments[]; .body | contains("${STARTED_MARKER}"))`,
      ) === "true",
  };
}

async function main() {
  const { GH_REPO, DEPLOYED_SHA, DEPLOY_URL, RUN_URL, DRY_RUN } = process.env;
  if (!GH_REPO || !DEPLOYED_SHA)
    throw new Error("GH_REPO and DEPLOYED_SHA are required.");

  const starts = await stepsToStart(DEPLOYED_SHA, cliGitHub(GH_REPO));
  if (starts.length === 0) console.log(`No step waits on ${DEPLOYED_SHA}.`);
  for (const { issue, blocker, pull } of starts) {
    console.log(`#${issue}: #${pull} (#${blocker}) is in ${DEPLOYED_SHA}.`);
    if (DRY_RUN) continue;
    runGh("workflow", "run", "agent-implement.yml", "-f", `issue=${issue}`);
    const deploy = DEPLOY_URL
      ? `[production deploy](${DEPLOY_URL})`
      : "production deploy";
    runGh(
      "issue",
      "comment",
      String(issue),
      "--body",
      `Unblocked: the ${deploy} of ${DEPLOYED_SHA} contains #${pull}, #${blocker}'s step. [This run](${RUN_URL}) started the implementer. ${STARTED_MARKER} <!-- factory:status -->`,
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
