import { githubToken, isProblemReportingConfigured } from "./gate";
import { ProblemReportSchema, type ProblemReportInput } from "./report-schema";

const ISSUES_URL =
  "https://api.github.com/repos/MattPereira/open-caddie/issues";
const LABELS = ["agent:explore"];
const REFUSED = {
  ok: false,
  error: "You can't report problems here.",
} as const;

export type Reporter = { id: string; name: string; isPlatformAdmin: boolean };

export type ProblemReportsDeps = {
  fetch: typeof fetch;
  /** Reads the stored Player row, never the session or form input. */
  findReporter(playerId: string): Promise<Reporter | null>;
};

export type ProblemReportResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export function createProblemReports(deps: ProblemReportsDeps) {
  // Reports land labelled `agent:explore` and reach the explore agent without
  // the repo owner reviewing them, so Platform Admins are trusted like
  // collaborators here. Do not widen sending beyond them without revisiting
  // that trust (see #218).
  async function allowedReporter(
    playerId: string | null,
  ): Promise<Reporter | null> {
    if (!isProblemReportingConfigured() || !playerId) return null;
    const reporter = await deps.findReporter(playerId);
    return reporter?.isPlatformAdmin ? reporter : null;
  }

  async function canFile(playerId: string | null): Promise<boolean> {
    return (await allowedReporter(playerId)) !== null;
  }

  async function file(
    playerId: string | null,
    input: ProblemReportInput,
  ): Promise<ProblemReportResult> {
    const reporter = await allowedReporter(playerId);
    if (!reporter) return REFUSED;
    const parsed = ProblemReportSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0].message };
    }
    const { title, description } = parsed.data;
    return createIssue({
      title,
      body: issueBody(reporter, description),
      labels: LABELS,
    });
  }

  async function createIssue(issue: {
    title: string;
    body: string;
    labels: string[];
  }): Promise<ProblemReportResult> {
    let response: Response;
    try {
      response = await deps.fetch(ISSUES_URL, {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${githubToken()}`,
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify(issue),
      });
    } catch {
      return { ok: false, error: "Couldn't reach GitHub. Try again later." };
    }
    if (!response.ok) {
      return {
        ok: false,
        error: `GitHub refused the report (${response.status}). Try again later.`,
      };
    }
    const created = (await response.json()) as { html_url: string };
    return { ok: true, url: created.html_url };
  }

  return { canFile, file };
}

function issueBody(reporter: Reporter, description: string) {
  return `_Problem reported by **${reporter.name}** (Player \`${reporter.id}\`)_\n\n---\n\n${description}`;
}
