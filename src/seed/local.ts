import { assertLocalConnection, nodePostgresConfig } from "@/db/connection";
import { loadDatabaseUrl } from "@/db/env";

// Every `src/seed` command runs this before it loads `@/db`, which connects
// on import.
export function requireLocalDatabase() {
  const url = loadDatabaseUrl();

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
