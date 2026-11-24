import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import {
  type BreakingStatement,
  findBreakingStatements,
} from "./breaking-statements";

// Only added migrations count: edits to applied ones are db:check-migrations'.
// --no-renames keeps a new migration that git pairs with a deleted file as "A".

const BASE = "origin/main";
const SKILL = ".agents/skills/database-migrations";

const DROP_FIX = `remove it from schema.ts now and drop it in a follow-up (${SKILL}/SKILL.md, Breaking statements).`;
const CODE_FIRST_FIX = `ship code that always writes the column first, then this statement in a follow-up (${SKILL}/SKILL.md, Breaking statements).`;

const FIX: Record<BreakingStatement["kind"], string> = {
  "drop-table": DROP_FIX,
  "drop-column": DROP_FIX,
  rename: `rename in TypeScript only, or follow ${SKILL}/EXPAND-CONTRACT.md.`,
  "change-type": `follow ${SKILL}/EXPAND-CONTRACT.md.`,
  "set-not-null": CODE_FIRST_FIX,
  "drop-default": CODE_FIRST_FIX,
};

const added = execFileSync(
  "git",
  [
    "diff",
    "--name-only",
    "--no-renames",
    "--diff-filter=A",
    `${BASE}...HEAD`,
    "--",
    "src/db/migrations/*.sql",
  ],
  { encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean);

const findings = added.flatMap((file) =>
  findBreakingStatements(readFileSync(file, "utf8")).map(
    ({ kind, statement }) => `  - ${file}: ${statement}\n    Fix: ${FIX[kind]}`,
  ),
);

if (findings.length > 0) {
  console.error(
    [
      "New migrations may break the code live in production while this deploy rolls out:",
      ...findings,
      "If the live code survives a statement, put `-- deploy-safe: <reason>` on the line above it.",
    ].join("\n"),
  );
  process.exit(1);
}
console.log(
  `No breaking statements in ${added.length} new migration(s) since ${BASE}.`,
);
