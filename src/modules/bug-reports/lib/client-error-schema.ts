import { z } from "zod";

export const CLIENT_ERROR_LIMIT = 20;
export const CLIENT_ERROR_MESSAGE_MAX = 2000;

export const ClientErrorSchema = z.object({
  at: z.string().max(40),
  kind: z.enum(["error", "unhandledrejection", "console", "boundary"]),
  message: z.string().max(CLIENT_ERROR_MESSAGE_MAX),
  /** Next.js's hash of a server error, to match it in the Vercel logs. */
  digest: z.string().max(100).optional(),
});

export type ClientError = z.infer<typeof ClientErrorSchema>;
