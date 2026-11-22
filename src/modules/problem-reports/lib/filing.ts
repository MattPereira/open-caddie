import { createGitHubIssue, type IssueResult } from "./github";
import {
  describePageContext,
  shortCommitSha,
  type PageContextInput,
} from "./page-context";
import { ProblemReportSchema, type ProblemReportInput } from "./report-schema";
import { getProblemReporter, type Reporter } from "./reporter";

const LABELS = ["agent:explore"];
const REFUSED = {
  ok: false,
  error: "You can't report problems here.",
} as const;
const LOOKUP_FAILED = {
  ok: false,
  error: "Couldn't file the report. Try again later.",
} as const;

export type ProblemReportSubmission = ProblemReportInput & PageContextInput;

export type ProblemReportResult = IssueResult;

export async function fileProblemReport(
  playerId: string | null,
  input: ProblemReportSubmission,
  fetch: typeof globalThis.fetch = globalThis.fetch,
): Promise<ProblemReportResult> {
  let reporter: Reporter | null;
  try {
    reporter = await getProblemReporter(playerId);
  } catch {
    return LOOKUP_FAILED;
  }
  if (!reporter) return REFUSED;
  const parsed = ProblemReportSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const { title, description } = parsed.data;
  return createGitHubIssue(fetch, {
    title,
    body: issueBody(reporter, description, describePageContext(input)),
    labels: LABELS,
  });
}

function issueBody(
  reporter: Reporter,
  description: string,
  page: { path: string; viewport: number | null },
) {
  const viewport = page.viewport === null ? "unknown" : `${page.viewport}px`;
  return [
    `_Problem reported by **${reporter.name}** (Player \`${reporter.id}\`) on \`${page.path}\`_`,
    `_\`${shortCommitSha()}\` · viewport ${viewport}_`,
    "",
    "---",
    "",
    description,
  ].join("\n");
}
