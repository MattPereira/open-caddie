// The GitHub CLI adapter shared by expand-contract.ts and
// expand-contract-merge.ts.
import { execFileSync } from "node:child_process";

export interface Step {
  number: number;
  blockers: { number: number; closed: boolean }[];
}

export interface MergedPull {
  number: number;
  mergeCommit: string;
}

export interface GitHub {
  /** Open `expand-contract` issues. */
  openSteps(): Promise<Step[]>;
  stepsClosedBy(pull: number): Promise<Step[]>;
  mergedClosingPulls(issue: number): Promise<MergedPull[]>;
  isAncestor(commit: string, of: string): Promise<boolean>;
}

export const STEP_LABEL = "expand-contract";
export const POLL_MS = 20_000;

export function runGh(...args: string[]): string {
  return execFileSync("gh", args, { encoding: "utf8" }).trim();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function graphql<T>(
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

export function cliGitHub(repo: string): GitHub {
  const [owner, name] = repo.split("/");
  return {
    openSteps: async () => {
      const data = graphql<{
        repository: { issues: { nodes: IssueNode[] } };
      }>(
        `query ($owner: String!, $name: String!, $label: String!) {
          repository(owner: $owner, name: $name) {
            issues(first: 100, states: OPEN, labels: [$label]) { nodes { ${ISSUE_FIELDS} } }
          }
        }`,
        { owner, name, label: STEP_LABEL },
      );
      return toSteps(data.repository.issues.nodes);
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
    mergedClosingPulls: async (issue) =>
      closingPulls(repo, issue).flatMap((pull) =>
        pull.merged && pull.mergeCommit
          ? [{ number: pull.number, mergeCommit: pull.mergeCommit.oid }]
          : [],
      ),
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

export function closingPulls(
  repo: string,
  issue: number,
): { number: number; merged: boolean; mergeCommit: { oid: string } | null }[] {
  const [owner, name] = repo.split("/");
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
            closedByPullRequestsReferences(first: 20, includeClosedPrs: true) {
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
  return data.repository.issue.closedByPullRequestsReferences.nodes;
}

export function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
