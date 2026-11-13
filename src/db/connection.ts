import type { ClientConfig } from "pg";

// Shared by `@/db` and the db test setup so both connect, and check locality,
// the same way. Not part of the app's db API: app code imports `@/db`.

export type ConnectionEnv = Record<string, string | undefined>;

export function nodePostgresConfig(
  env: ConnectionEnv,
  connectionString: string,
  database: string | undefined,
): ClientConfig {
  return env.DATABASE_LOCAL_SOCKET
    ? {
        host: env.DATABASE_LOCAL_SOCKET,
        database,
        // eslint-disable-next-line local/player-domain-term -- Postgres role, not a Player
        user: env.DATABASE_USER,
      }
    : { connectionString };
}

export function assertLocalConnection(
  config: ClientConfig,
  env: ConnectionEnv,
) {
  const host = connectionHost(config, env);
  const isLocal =
    host.startsWith("/") || ["localhost", "127.0.0.1", "::1"].includes(host);
  if (!isLocal) {
    throw new Error(
      `Refusing to connect to non-local database host "${host}" under vitest`,
    );
  }
}

function connectionHost(config: ClientConfig, env: ConnectionEnv) {
  if (config.host) return config.host;
  const url = new URL(config.connectionString!);
  const host = (
    url.searchParams.get("host") ?? decodeURIComponent(url.hostname)
  ).replace(/^\[(.*)\]$/, "$1");
  // pg fills an empty host from PGHOST, then localhost.
  return host || env.PGHOST || "localhost";
}
