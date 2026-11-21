import { z } from "zod/v4";

const axis = z
  .enum(["standards", "spec"])
  .describe("The verdict section the finding belongs to.");

const title = z
  .string()
  .min(1)
  .describe(
    "The finding in a few words, plain text, e.g. 'Server module imports a UI component'.",
  );

// What the review fixed and what it left. The verdict lists both under each
// axis; the workflow posts each finding left as an inline comment on the pull
// request, on its file and line.
export const reviewSchema = z
  .strictObject({
    fixes: z
      .array(
        z.strictObject({
          axis,
          title,
          commit: z
            .string()
            .regex(/^[0-9a-f]{7,40}$/)
            .describe("The SHA of the commit that fixed it."),
          rule: z
            .string()
            .min(1)
            .describe(
              "The standard it broke, by heading, or the spec line it missed.",
            ),
        }),
      )
      .describe("One entry per finding you fixed, worst first. Empty is fine."),
    comments: z
      .array(
        z.strictObject({
          axis,
          title,
          path: z
            .string()
            .min(1)
            .describe("The file, relative to the repository root."),
          line: z
            .number()
            .int()
            .positive()
            .describe(
              "A line in the file as it is now, inside a hunk of the diff against the base. A comment outside the hunks goes into the verdict instead.",
            ),
          body: z
            .string()
            .min(1)
            .describe(
              "The finding, in Markdown: the rule or spec line it breaks, why it could not be fixed here, and what to do instead.",
            ),
        }),
      )
      .describe(
        "One entry per finding you left unfixed, on the first line it concerns. Empty is fine.",
      ),
  })
  .describe("The findings the review fixed and the ones it left.");

export type ReviewFix = z.infer<typeof reviewSchema>["fixes"][number];
export type ReviewComment = z.infer<typeof reviewSchema>["comments"][number];
