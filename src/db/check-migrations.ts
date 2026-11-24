import { readFileSync } from "node:fs";

import { config } from "dotenv";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { Client } from "pg";

import {
  type AppliedMigration,
  findMigrationDrift,
  type MigrationDrift,
  type RepoMigration,
} from "./migration-drift";

// Runs before `pnpm db:migrate` in the Vercel build (ADR 0006), so it checks
// the database drizzle-kit is about to migrate. Same env files as
// drizzle.config.ts for local runs.
config({ path: [".env.development.local", ".env.local"], quiet: true });

const MIGRATIONS_FOLDER = "src/db/migrations";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const drift = findMigrationDrift(await readApplied(url), readRepo());
if (drift.length > 0) {
  console.error(
    [
      "Applied migrations differ from src/db/migrations; drizzle would skip these silently:",
      ...drift.map((d) => `  - ${describe(d)}\n    Fix: ${fix(d)}`),
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

function describe(drift: MigrationDrift) {
  switch (drift.kind) {
    case "edited":
      return `${drift.tag} was edited after it was applied`;
    case "missing":
      return `the migration applied with timestamp ${drift.createdAt} is no longer in the repo`;
    case "skipped":
      return `${drift.tag} is older than the newest applied migration, so it would never run`;
  }
}

function fix(drift: MigrationDrift) {
  if (drift.kind === "skipped") {
    return "regenerate it (`pnpm db:generate`) so its journal `when` is newer than every applied migration.";
  }
  if (process.env.VERCEL_ENV === "preview") {
    const branch = process.env.VERCEL_GIT_COMMIT_REF ?? "<git-branch>";
    return `reset preview/${branch} from production in Neon, then redeploy.`;
  }
  return "restore the migration as applied and put the change in a new migration (`pnpm db:generate`).";
}
