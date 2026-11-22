export function githubToken(): string | undefined {
  return process.env.PROBLEM_REPORT_GITHUB_TOKEN || undefined;
}

/** Player-independent half of the gate, for deciding what to render. */
export function isProblemReportingConfigured(): boolean {
  return githubToken() !== undefined && process.env.VERCEL_ENV === "production";
}
