import { execFileSync, spawnSync } from "node:child_process";

// Lints only added migrations: applied ones are frozen, and edits to them are
// db:check-migrations'. --no-renames keeps a new migration that git pairs with
// a deleted file as "A". Rules live in .squawk.toml.

const BASE = "origin/main";

const MIGRATIONS = "src/db/migrations/*.sql";

const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8" }).split("\n").filter(Boolean);

// Diffs the working tree, not HEAD, so a local run sees a migration the agent
// hasn't committed yet; untracked files need ls-files on top.
const [mergeBase] = git("merge-base", BASE, "HEAD");
const added = [
  ...git(
    "diff",
    "--name-only",
    "--no-renames",
    "--diff-filter=A",
    mergeBase,
    "--",
    MIGRATIONS,
  ),
  ...git("ls-files", "--others", "--exclude-standard", "--", MIGRATIONS),
];

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
