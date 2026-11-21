import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as sandcastle from "@ai-hero/sandcastle";
import { noSandbox } from "@ai-hero/sandcastle/sandboxes/no-sandbox";
import type { z } from "zod/v4";
import {
  claudeAgent,
  required,
  screenshotRules,
  writeJson,
} from "../shared/common";
import { extractionPrompt } from "../shared/extraction-prompt";
import { runWithExtraction } from "../shared/run-with-extraction";
import { diffLines } from "./diff-lines";
import { addFindings } from "./findings";
import { pinFixCommits } from "./fix-commits";
import { reviewSchema } from "./review-schema";

const BASE_REF = required("BASE_REF");
const HEAD_SHA = required("HEAD_SHA");
const VERDICT = "/tmp/review-verdict.md";

// The agent fixes and commits, writes the verdict file, and hands back the
// findings it fixed and left. This script lists those in the verdict. The
// workflow pushes the commits, posts the verdict and the inline comments,
// and marks the PR ready.
const result = await runWithExtraction({
  name: "review",
  agent: claudeAgent(),
  sandbox: noSandbox(),
  logging: { type: "stdout" },
  promptFile: path.join(import.meta.dirname, "prompt.md"),
  promptArgs: {
    PR_NUMBER: required("PR_NUMBER"),
    BRANCH: required("BRANCH"),
    BASE_REF,
    SCREENSHOTS: screenshotRules(),
  },
  output: sandcastle.Output.object({ tag: "findings", schema: reviewSchema }),
  extractionPrompt: extractionPrompt("findings", reviewSchema),
});

const git = (...args: string[]): string =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

// The diff after the agent's commits: the comments land on that.
const hunks = diffLines(git("diff", `origin/${BASE_REF}...HEAD`));
const { fixes, comments: found }: z.infer<typeof reviewSchema> = result.output;
const inDiff = ({ path: file, line }: { path: string; line: number }) =>
  hunks.get(file)?.has(line) ?? false;
const posted = found.filter(inDiff);
const dropped = found.filter((comment) => !inDiff(comment));
for (const { path: file, line } of dropped) {
  console.error(
    `${file}:${line} is not in the diff: the finding goes in the verdict.`,
  );
}

const made = git("log", "--format=%H %h", `${HEAD_SHA}..HEAD`)
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [full, short] = line.split(" ");
    return { full, short };
  });
const { fixed, unknown } = pinFixCommits(fixes, made);
for (const sha of unknown) {
  console.error(`${sha} is not a commit this review made.`);
}

// With no verdict, the findings still need a home. No `## Standards:`
// heading, so the workflow leaves the PR a draft.
const verdict = fs.existsSync(VERDICT)
  ? fs.readFileSync(VERDICT, "utf8")
  : "The review run produced no verdict. See the logs. Re-add `agent:review` to retry.\n";
fs.writeFileSync(VERDICT, addFindings(verdict, { fixed, posted, dropped }));

// The request body for POST /repos/{owner}/{repo}/pulls/{n}/reviews.
writeJson("review-comments.json", {
  commit_id: git("rev-parse", "HEAD").trim(),
  event: "COMMENT",
  body: "The findings this review left for you, on their lines. The verdict is in its own comment.",
  comments: posted.map(({ path: file, line, body }) => ({
    path: file,
    line,
    body,
    side: "RIGHT",
  })),
});
