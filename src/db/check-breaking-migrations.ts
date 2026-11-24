import { execFileSync, spawnSync } from "node:child_process";

// Lints only added migrations: applied ones are frozen, and edits to them are
// db:check-migrations'. --no-renames keeps a new migration that git pairs with
// a deleted file as "A". Rules live in .squawk.toml.

const BASE = "origin/main";

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

if (added.length === 0) {
  console.log(`No new migrations since ${BASE}.`);
  process.exit(0);
}

const { status } = spawnSync("squawk", added, { stdio: "inherit" });
if (status !== 0) {
  console.error(
    [
      "These statements may break the code live in production while this deploy rolls out.",
      "How to ship each: .agents/skills/database-migrations/SKILL.md, Breaking statements.",
    ].join("\n"),
  );
  process.exit(status ?? 1);
}
