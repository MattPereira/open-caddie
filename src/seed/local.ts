import { assertLocalConnection, nodePostgresConfig } from "@/db/connection";
import { loadDatabaseUrl } from "@/db/env";

import { prodCopyUrl } from "./prod-copy-url";

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

// The URL of the prod copy (`pnpm db:copy-prod`), for the commands that run
// against it instead of the seed.
export function requireProdCopyUrl() {
  requireLocalDatabase();
  // The socket vars connect by DATABASE_NAME and ignore the database in
  // DATABASE_URL, so swapping it would silently keep the seed.
  if (process.env.DATABASE_LOCAL_SOCKET) {
    throw new Error(
      "Set DATABASE_URL as a URL (postgresql:///open_caddie?host=/var/run/postgresql), not DATABASE_LOCAL_SOCKET",
    );
  }
  const copyUrl = prodCopyUrl(process.env.DATABASE_URL ?? "");
  assertLocalConnection({ connectionString: copyUrl }, process.env);
  return copyUrl;
}
