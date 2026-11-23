const ISSUES_URL =
  "https://api.github.com/repos/MattPereira/open-caddie/issues";

export type IssueResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export function githubToken(): string | undefined {
  return process.env.PROBLEM_REPORT_GITHUB_TOKEN || undefined;
}

export async function createGitHubIssue(
  fetch: typeof globalThis.fetch,
  issue: { title: string; body: string; labels: string[] },
): Promise<IssueResult> {
  let response: Response;
  try {
    response = await fetch(ISSUES_URL, {
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
  const url = await issueUrl(response);
  if (!url) {
    // GitHub said yes, so the issue may exist even though the reply is unreadable.
    return {
      ok: false,
      error:
        "GitHub didn't return a link to the report. Check GitHub before trying again.",
    };
  }
  return { ok: true, url };
}

async function issueUrl(response: Response): Promise<string | null> {
  let created: unknown;
  try {
    created = await response.json();
  } catch {
    return null;
  }
  const url = (created as { html_url?: unknown } | null)?.html_url;
  return typeof url === "string" ? url : null;
}
