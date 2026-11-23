import { createGitHubIssue, type IssueResult } from "./github";
import type { ClientError } from "./client-error-schema";
import {
  describePageContext,
  shortCommitSha,
  type PageContext,
  type PageContextInput,
} from "./page-context";
import { BugReportSchema, type BugReportInput } from "./report-schema";
import { getBugReporter, type Reporter } from "./reporter";

// Not agent:explore: bug-report-snapshot.yml adds that once prod is snapshotted.
const LABELS = ["live-bug-report"];
const REFUSED = {
  ok: false,
  error: "You can't report bugs here.",
} as const;
const LOOKUP_FAILED = {
  ok: false,
  error: "Couldn't file the report. Try again later.",
} as const;

export type BugReportSubmission = BugReportInput & PageContextInput;

export type BugReportResult = IssueResult;

export async function fileBugReport(
  playerId: string | null,
  input: BugReportSubmission,
  fetch: typeof globalThis.fetch = globalThis.fetch,
): Promise<BugReportResult> {
  let reporter: Reporter | null;
  try {
    reporter = await getBugReporter(playerId);
  } catch {
    return LOOKUP_FAILED;
  }
  if (!reporter) return REFUSED;
  const parsed = BugReportSchema.safeParse(input);
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

function issueBody(reporter: Reporter, description: string, page: PageContext) {
  const viewport = page.viewport === null ? "unknown" : `${page.viewport}px`;
  return [
    `_Bug reported by **${reporter.name}** (Player \`${reporter.id}\`) on \`${page.path}\`_`,
    `_\`${shortCommitSha()}\` · viewport ${viewport}_`,
    "",
    "---",
    "",
    description,
    ...clientErrorsSection(page.clientErrors),
  ].join("\n");
}

function clientErrorsSection(errors: ClientError[]) {
  if (errors.length === 0) return [];
  const lines = errors.map(
    ({ at, kind, digest, message }) =>
      `${at} ${kind}${digest ? ` digest ${digest}` : ""}: ${message}`,
  );
  const fence = fenceFor(lines);
  return [
    "",
    "---",
    "",
    `**Errors in the reporter's browser**, oldest first:`,
    "",
    `${fence}text`,
    ...lines,
    fence,
  ];
}

/** Longer than any backtick run inside, so an error can't close the block. */
function fenceFor(lines: string[]) {
  const runs = lines.join("\n").match(/`+/g) ?? [];
  const longest = Math.max(0, ...runs.map((run) => run.length));
  return "`".repeat(Math.max(3, longest + 1));
}
