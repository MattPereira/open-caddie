import { config } from "dotenv";

import { assertLocalConnection, nodePostgresConfig } from "@/db/connection";

/**
 * Loads env like `pnpm db:migrate` and refuses anything but a local Postgres.
 * Every `src/seed` command runs this before it loads `@/db`, which connects
 * on import.
 */
export function requireLocalDatabase() {
  // Variables already set win over .env.local.
  config({ path: ".env.local", quiet: true });

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  // The app's default Neon driver can't reach a local Postgres.
  process.env.DATABASE_DRIVER ??= "node-postgres";
  if (process.env.DATABASE_DRIVER !== "node-postgres") {
    throw new Error(
      "Local database commands need DATABASE_DRIVER=node-postgres",
    );
  }
  const connection = nodePostgresConfig(
    process.env,
    url,
    process.env.DATABASE_NAME,
  );
  assertLocalConnection(connection, process.env);
  return connection;
}
