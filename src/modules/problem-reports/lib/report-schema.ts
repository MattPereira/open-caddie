import { z } from "zod";

const PROBLEM_REPORT_TITLE_MAX = 200;
const PROBLEM_REPORT_DESCRIPTION_MAX = 10_000;

export const ProblemReportSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required.")
    .max(
      PROBLEM_REPORT_TITLE_MAX,
      `Title must be at most ${PROBLEM_REPORT_TITLE_MAX} characters.`,
    ),
  description: z
    .string()
    .trim()
    .min(1, "Describe what went wrong.")
    .max(
      PROBLEM_REPORT_DESCRIPTION_MAX,
      `Description must be at most ${PROBLEM_REPORT_DESCRIPTION_MAX.toLocaleString("en-US")} characters.`,
    ),
});

export type ProblemReportInput = z.input<typeof ProblemReportSchema>;
