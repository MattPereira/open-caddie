import type { ReviewFix } from "./review-schema";

export type Commit = { full: string; short: string };

// The agent names each fix's commit by whatever prefix it wrote. The verdict
// shows the short SHA of the commit this run made, so every entry reads the
// same; a SHA that names no such commit stays as the agent wrote it, and
// comes back in `unknown` for the log.
export const pinFixCommits = (
  fixes: ReviewFix[],
  made: Commit[],
): { fixed: ReviewFix[]; unknown: string[] } => {
  const unknown: string[] = [];
  const fixed = fixes.map((fix) => {
    const commit = made.find(({ full }) => full.startsWith(fix.commit));
    if (commit) return { ...fix, commit: commit.short };
    unknown.push(fix.commit);
    return fix;
  });
  return { fixed, unknown };
};
