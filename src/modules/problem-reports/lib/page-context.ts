import { z } from "zod";

const UNKNOWN = "unknown";

const PathSchema = z
  .string()
  .startsWith("/")
  .max(2000)
  // A backtick would close the Markdown code span the path is shown in.
  .transform((path) => path.replaceAll("`", ""));

const ViewportSchema = z.number().int().positive().max(10_000);

/** Where the report was sent from, captured by the browser at submit time. */
export type PageContextInput = { path?: unknown; viewport?: unknown };

/** Never rejects: an invalid path is `unknown`, an invalid viewport `null`. */
export function describePageContext(input: PageContextInput) {
  const path = PathSchema.safeParse(input.path);
  const viewport = ViewportSchema.safeParse(input.viewport);
  return {
    path: path.success ? path.data : UNKNOWN,
    viewport: viewport.success ? viewport.data : null,
  };
}

export function shortCommitSha(): string {
  return process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || UNKNOWN;
}
