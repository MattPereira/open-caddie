import ws from "ws";
import { Pool } from "pg";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";

import { assertLocalConnection, nodePostgresConfig } from "./connection";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const nodePostgres = process.env.DATABASE_DRIVER === "node-postgres";
const config = nodePostgres
  ? nodePostgresConfig(
      process.env,
      process.env.DATABASE_URL,
      process.env.DATABASE_NAME,
    )
  : { connectionString: process.env.DATABASE_URL };

// Tests must never reach prod. Scoped to vitest on purpose: whether dev and
// deploy get a guard is a separate decision (#111).
if (process.env.VITEST) assertLocalConnection(config, process.env);

export const db = nodePostgres
  ? drizzleNodePostgres(new Pool(config))
  : drizzleNeon({ connection: process.env.DATABASE_URL, ws });

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
