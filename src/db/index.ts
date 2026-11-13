import ws from "ws";
import { Pool } from "pg";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// Tests must never reach prod. Dev and deploy are left alone until #111.
if (process.env.VITEST) {
  const host = connectionHost();
  const isLocal =
    host === "" ||
    host.startsWith("/") ||
    ["localhost", "127.0.0.1", "::1"].includes(host);
  if (!isLocal) {
    throw new Error(
      `Refusing to connect to non-local database host "${host}" under vitest`,
    );
  }
}

function connectionHost() {
  if (
    process.env.DATABASE_DRIVER === "node-postgres" &&
    process.env.DATABASE_LOCAL_SOCKET
  ) {
    return process.env.DATABASE_LOCAL_SOCKET;
  }
  const url = new URL(process.env.DATABASE_URL!);
  const host =
    url.searchParams.get("host") ?? decodeURIComponent(url.hostname);
  return host.replace(/^\[(.*)\]$/, "$1");
}

export const db =
  process.env.DATABASE_DRIVER === "node-postgres"
    ? drizzleNodePostgres(
        new Pool(
          process.env.DATABASE_LOCAL_SOCKET
            ? {
                host: process.env.DATABASE_LOCAL_SOCKET,
                database: process.env.DATABASE_NAME,
                // eslint-disable-next-line local/player-domain-term -- Postgres role, not a Player
                user: process.env.DATABASE_USER,
              }
            : { connectionString: process.env.DATABASE_URL },
        ),
      )
    : drizzleNeon({
        connection: process.env.DATABASE_URL,
        ws,
      });

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
