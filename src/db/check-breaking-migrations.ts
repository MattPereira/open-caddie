import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { findBreakingStatements } from "./breaking-statements";

// Runs in CI on each PR: Vercel migrates before the new code is live, so a
// statement the live code can't survive must ship through expand/contract.
// Only added migrations count; edits to applied ones are db:check-migrations'.

const base = process.argv[2] ?? "origin/main";

const added = execFileSync(
  "git",
  [
    "diff",
    "--name-only",
    "--diff-filter=A",
    `${base}...HEAD`,
    "--",
    "src/db/migrations/*.sql",
  ],
  { encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean);

const findings = added.flatMap((file) =>
  findBreakingStatements(readFileSync(file, "utf8")).map(
    ({ kind, statement }) => `  - ${file} (${kind}): ${statement}`,
  ),
);

if (findings.length > 0) {
  console.error(
    [
      "New migrations may break the code live in production while this deploy rolls out:",
      ...findings,
      "Split the change with expand/contract (.agents/skills/database-migrations/SKILL.md).",
      "If the live code survives it, put `-- deploy-safe: <reason>` on the line above the statement.",
    ].join("\n"),
  );
  process.exit(1);
}
console.log(
  `No breaking statements in ${added.length} new migration(s) since ${base}.`,
);
