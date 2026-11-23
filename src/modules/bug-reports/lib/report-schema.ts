import { z } from "zod";

const BUG_REPORT_TITLE_MAX = 200;
const BUG_REPORT_DESCRIPTION_MAX = 10_000;

export const BugReportSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required.")
    .max(
      BUG_REPORT_TITLE_MAX,
      `Title must be at most ${BUG_REPORT_TITLE_MAX} characters.`,
    ),
  description: z
    .string()
    .trim()
    .min(1, "Describe what went wrong.")
    .max(
      BUG_REPORT_DESCRIPTION_MAX,
      `Description must be at most ${BUG_REPORT_DESCRIPTION_MAX.toLocaleString("en-US")} characters.`,
    ),
});

export type BugReportInput = z.input<typeof BugReportSchema>;
