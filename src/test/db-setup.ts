import { sql } from "drizzle-orm";
import { beforeEach } from "vitest";

import {
  baseDatabaseName,
  databaseUrl,
  quoteIdent,
  templateName,
  withMaintenanceClient,
  workerName,
} from "./test-databases";

// Runs in each worker before the suite's imports, so `@/db` binds to this
// worker's database. A pool ID belongs to one worker at a time, so the
// existence check cannot race another worker.
const base = baseDatabaseName(process.env);
const database = workerName(base, process.env.VITEST_POOL_ID ?? "0");

await withMaintenanceClient(process.env, async (client) => {
  const { rowCount } = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [database],
  );
  if (!rowCount) {
    await client.query(
      `CREATE DATABASE ${quoteIdent(database)} TEMPLATE ${quoteIdent(templateName(base))}`,
    );
  }
});

process.env.DATABASE_URL = databaseUrl(process.env, database);
process.env.DATABASE_NAME = database;

const { db } = await import("@/db");

// Discovered from the catalog so new tables need no upkeep; drizzle's
// migrations live in their own schema and survive.
const { rows } = await db.execute<{ tablename: string }>(
  sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
);
const truncate = rows.length
  ? sql.raw(
      `TRUNCATE ${rows.map((row) => `public.${quoteIdent(row.tablename)}`).join(", ")} RESTART IDENTITY CASCADE`,
    )
  : undefined;

beforeEach(async () => {
  if (truncate) await db.execute(truncate);
});
