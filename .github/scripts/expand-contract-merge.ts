// The review's merge of a clean expand/contract step (agent-review.yml).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  cliGitHub,
  graphql,
  POLL_MS,
  required,
  runGh,
  sleep,
} from "./expand-contract-github.ts";

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
  | { action: "merge" }
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
    ? { action: "merge" }
    : { action: "needs-a-human", reasons };
}

const MIGRATION = /^src\/db\/migrations\/.*\.sql$/;

export function migrationDrops(diff: string): string[] {
  const drops = new Set<string>();
  let file = "";
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) file = line.replace(/^\+\+\+ b\//, "");
    else if (line.startsWith("+") && /\bDROP\b/i.test(line)) drops.add(file);
  }
  return [...drops].filter((file) => MIGRATION.test(file));
}

export interface CheckContext {
  required: boolean;
  state: "pass" | "fail" | "pending";
}

export type ChecksVerdict = "passed" | "failed" | "pending";

// No required check yet is pending, not passed: right after a push, the
// checks have not registered.
export function checksVerdict(contexts: CheckContext[]): ChecksVerdict {
  const required = contexts.filter((c) => c.required);
  if (required.some((c) => c.state === "fail")) return "failed";
  if (required.length === 0 || required.some((c) => c.state === "pending"))
    return "pending";
  return "passed";
}

export interface MergeOps {
  head(): Promise<{ sha: string; behind: boolean }>;
  /** Merges main into the branch; resolves to the new head. */
  updateBranch(): Promise<string>;
  waitForChecks(sha: string): Promise<"passed" | "failed" | "timed-out">;
  /** False when GitHub refused, e.g. main moved since the checks ran. */
  merge(sha: string): Promise<boolean>;
}

export type MergeResult = { merged: true } | { merged: false; reason: string };

export const MERGE_ATTEMPTS = 3;
export const CHECKS_WAIT_MINUTES = 30;

// `protect main` requires an up-to-date branch, so each attempt updates from
// main when it is behind. Merges only the reviewed commit or our own updates
// of it: a push by anyone else stops it.
export async function mergeWhenGreen(
  reviewedSha: string,
  ops: MergeOps,
): Promise<MergeResult> {
  let expectedHead = reviewedSha;
  for (let attempt = 0; attempt < MERGE_ATTEMPTS; attempt++) {
    const head = await ops.head();
    if (head.sha !== expectedHead)
      return {
        merged: false,
        reason: `\`${head.sha.slice(0, 7)}\` was pushed after the review.`,
      };
    if (head.behind) expectedHead = await ops.updateBranch();
    const checks = await ops.waitForChecks(expectedHead);
    if (checks === "failed")
      return { merged: false, reason: "A required check failed." };
    if (checks === "timed-out")
      return {
        merged: false,
        reason: `The required checks did not finish within ${CHECKS_WAIT_MINUTES} minutes.`,
      };
    if (await ops.merge(expectedHead)) return { merged: true };
  }
  return {
    merged: false,
    reason: `Main moved under ${MERGE_ATTEMPTS} merge attempts.`,
  };
}

export async function merge(repo: string, env: NodeJS.ProcessEnv) {
  const pull = Number(required(env.PULL, "PULL"));
  // Checked first, so a failure in the rest can't touch an unrelated PR.
  const closesStep = (await cliGitHub(repo).stepsClosedBy(pull)).length > 0;
  if (!closesStep) {
    console.log(`#${pull} closes no expand/contract step.`);
    return;
  }
  const review = JSON.parse(
    readFileSync(required(env.MERGE_FILE, "MERGE_FILE"), "utf8"),
  ) as { merge: MergeCall; findingsLeft: number };
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }).trim();
  const decision = mergeDecision({
    closesStep,
    call: review.merge,
    findingsLeft: review.findingsLeft,
    drops: migrationDrops(
      git("diff", `origin/${required(env.BASE_REF, "BASE_REF")}...HEAD`),
    ),
  });
  console.log(`#${pull}: ${JSON.stringify(decision)}`);
  if (env.DRY_RUN || decision.action === "none") return;
  const reasons =
    decision.action === "needs-a-human"
      ? decision.reasons
      : await mergeWhenGreen(
          git("rev-parse", "HEAD"),
          cliMergeOps(repo, pull),
        ).then((result) => (result.merged ? [] : [result.reason]));
  if (reasons.length === 0) {
    console.log(`#${pull} merged.`);
    return;
  }
  runGh(
    "pr",
    "comment",
    String(pull),
    "--body",
    [
      "This expand/contract step needs a human to merge it:",
      "",
      ...reasons.map((reason) => `- ${reason}`),
      "",
      `Merge it yourself once its checks pass. <!-- factory:status -->`,
    ].join("\n"),
  );
}

function cliMergeOps(repo: string, pull: number): MergeOps {
  const [owner, name] = repo.split("/");
  const deadline = Date.now() + CHECKS_WAIT_MINUTES * 60_000;
  // Compared with the base, not `mergeStateStatus`: that reads BLOCKED, not
  // BEHIND, while the required checks are pending.
  const head = async () => {
    const view = JSON.parse(
      runGh("pr", "view", String(pull), "--json", "headRefOid,baseRefName"),
    ) as { headRefOid: string; baseRefName: string };
    const behindBy = Number(
      runGh(
        "api",
        `repos/${repo}/compare/${view.baseRefName}...${view.headRefOid}`,
        "--jq",
        ".behind_by",
      ),
    );
    return { sha: view.headRefOid, behind: behindBy > 0 };
  };
  return {
    head,
    updateBranch: async () => {
      const before = (await head()).sha;
      runGh("pr", "update-branch", String(pull));
      // The update lands asynchronously.
      while (Date.now() < deadline) {
        const after = (await head()).sha;
        if (after !== before) return after;
        await sleep(5_000);
      }
      throw new Error(`#${pull}'s branch update did not land.`);
    },
    waitForChecks: async (sha) => {
      while (Date.now() < deadline) {
        const verdict = checksVerdict(requiredContexts(owner, name, pull, sha));
        if (verdict !== "pending") return verdict;
        await sleep(POLL_MS);
      }
      return "timed-out";
    },
    merge: async (sha) => {
      try {
        runGh(
          "pr",
          "merge",
          String(pull),
          "--squash",
          "--match-head-commit",
          sha,
        );
        return true;
      } catch (error) {
        console.log(`#${pull} refused the merge: ${error}`);
        return false;
      }
    },
  };
}

type RollupNode =
  | {
      __typename: "CheckRun";
      status: string;
      conclusion: string | null;
      isRequired: boolean;
    }
  | { __typename: "StatusContext"; state: string; isRequired: boolean };

function requiredContexts(
  owner: string,
  name: string,
  pull: number,
  sha: string,
): CheckContext[] {
  const data = graphql<{
    repository: {
      object: {
        statusCheckRollup: { contexts: { nodes: RollupNode[] } } | null;
      };
    };
  }>(
    `
      query ($owner: String!, $name: String!, $sha: GitObjectID!, $pull: Int!) {
        repository(owner: $owner, name: $name) {
          object(oid: $sha) {
            ... on Commit {
              statusCheckRollup {
                contexts(first: 100) {
                  nodes {
                    __typename
                    ... on CheckRun {
                      status
                      conclusion
                      isRequired(pullRequestNumber: $pull)
                    }
                    ... on StatusContext {
                      state
                      isRequired(pullRequestNumber: $pull)
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    { owner, name, sha, pull },
  );
  const nodes = data.repository.object.statusCheckRollup?.contexts.nodes ?? [];
  return nodes.map((node) => ({
    required: node.isRequired,
    state: contextState(node),
  }));
}

function contextState(node: RollupNode): CheckContext["state"] {
  if (node.__typename === "StatusContext")
    return node.state === "SUCCESS"
      ? "pass"
      : node.state === "PENDING" || node.state === "EXPECTED"
        ? "pending"
        : "fail";
  if (node.status !== "COMPLETED") return "pending";
  return ["SUCCESS", "NEUTRAL", "SKIPPED"].includes(node.conclusion ?? "")
    ? "pass"
    : "fail";
}
