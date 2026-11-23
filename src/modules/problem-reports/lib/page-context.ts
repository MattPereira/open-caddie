import { z } from "zod";

import {
  CLIENT_ERROR_LIMIT,
  ClientErrorSchema,
  type ClientError,
} from "./client-error-schema";

const UNKNOWN = "unknown";

const PathSchema = z
  .string()
  .startsWith("/")
  .max(2000)
  // A backtick would close the Markdown code span the path is shown in.
  .transform((path) => path.replaceAll("`", ""));

const ViewportSchema = z.number().int().positive().max(10_000);

const ClientErrorsSchema = z.array(ClientErrorSchema).max(CLIENT_ERROR_LIMIT);

/** Where the report was sent from, captured by the browser at submit time. */
export type PageContextInput = {
  path?: unknown;
  viewport?: unknown;
  clientErrors?: unknown;
};

export type PageContext = {
  path: string;
  viewport: number | null;
  clientErrors: ClientError[];
};

/**
 * Never rejects: an invalid path is `unknown`, an invalid viewport `null`,
 * and an invalid error list is empty.
 */
export function describePageContext(input: PageContextInput): PageContext {
  const path = PathSchema.safeParse(input.path);
  const viewport = ViewportSchema.safeParse(input.viewport);
  const clientErrors = ClientErrorsSchema.safeParse(input.clientErrors);
  return {
    path: path.success ? path.data : UNKNOWN,
    viewport: viewport.success ? viewport.data : null,
    clientErrors: clientErrors.success ? clientErrors.data : [],
  };
}

export function shortCommitSha(): string {
  return process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || UNKNOWN;
}
