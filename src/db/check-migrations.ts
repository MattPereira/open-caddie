import { readFileSync } from "node:fs";

import { readMigrationFiles } from "drizzle-orm/migrator";
import { Client } from "pg";

import {
  type AppliedMigration,
  findMigrationDrift,
  type MigrationDrift,
  type RepoMigration,
} from "./migration-drift";
import { loadDatabaseUrl } from "./env";

// Runs before `pnpm db:migrate` in the Vercel build (ADR 0006), against the
// database drizzle-kit is about to migrate.

const MIGRATIONS_FOLDER = "src/db/migrations";

const drift = findMigrationDrift(
  await readApplied(loadDatabaseUrl()),
  readRepo(),
);
if (drift.length > 0) {
  console.error(
    [
      "Applied migrations differ from src/db/migrations; drizzle would skip these silently:",
      ...drift.map(formatDrift),
    ].join("\n"),
  );
  process.exit(1);
}
console.log("Applied migrations match src/db/migrations.");

async function readApplied(connectionString: string) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const { rows } = await client.query<{ hash: string; created_at: string }>(
      "select hash, created_at from drizzle.__drizzle_migrations",
    );
    return rows.map((row): AppliedMigration => ({
      hash: row.hash,
      createdAt: Number(row.created_at),
    }));
  } catch (error) {
    if (isUndefinedTable(error)) return [];
    throw error;
  } finally {
    await client.end();
  }
}

function isUndefinedTable(error: unknown) {
  return (error as { code?: string }).code === "42P01";
}

function readRepo(): RepoMigration[] {
  const journal = JSON.parse(
    readFileSync(`${MIGRATIONS_FOLDER}/meta/_journal.json`, "utf8"),
  ) as { entries: { tag: string }[] };
  // readMigrationFiles hashes exactly as the migrator does, in journal order.
  return readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER }).map(
    (file, i) => ({
      tag: journal.entries[i].tag,
      when: file.folderMillis,
      hash: file.hash,
    }),
  );
}

function formatDrift(drift: MigrationDrift) {
  const { problem, prodFix, previewFollowUp } = reportFor(drift);
  return `  - ${problem}\n    Fix: ${isPreview() ? previewFix(previewFollowUp) : prodFix}`;
}

function reportFor(drift: MigrationDrift): {
  problem: string;
  prodFix: string;
  previewFollowUp?: string;
} {
  switch (drift.kind) {
    case "edited":
      return {
        problem: `${drift.tag} was edited after it was applied`,
        prodFix:
          "restore the migration as applied and put the change in a new migration (`pnpm db:generate`).",
      };
    case "missing":
      return {
        problem: `the migration applied with timestamp ${drift.createdAt} is no longer in the repo`,
        prodFix: "restore the removed migration file.",
      };
    case "skipped":
      return {
        problem: `${drift.tag} is older than the newest applied migration, so it would never run`,
        prodFix:
          "it never ran here, so delete it and run `pnpm db:generate` again to give it a newer timestamp.",
        previewFollowUp:
          "If it still fails, this branch's migration is older than one production has: delete it and run `pnpm db:generate` again.",
      };
  }
}

function isPreview() {
  return process.env.VERCEL_ENV === "preview";
}

function previewFix(followUp: string | undefined) {
  const branch = process.env.VERCEL_GIT_COMMIT_REF ?? "<git-branch>";
  const reset = `reset preview/${branch} from production in Neon, then redeploy.`;
  return followUp ? `${reset} ${followUp}` : reset;
}
