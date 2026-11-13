import { Client, type ClientConfig } from "pg";

// Names and connections for the db project's template and worker databases,
// all derived from the configured TEST_DATABASE_URL.

export function baseDatabaseName(env: Record<string, string | undefined>) {
  return new URL(env.TEST_DATABASE_URL!).pathname.slice(1);
}

export function templateName(base: string) {
  return `${base}_template`;
}

export function workerName(base: string, poolId: string) {
  return `${base}_w${poolId}`;
}

export function isRunDatabase(base: string, name: string) {
  return (
    name === templateName(base) ||
    new RegExp(`^${escapeRegExp(base)}_w\\d+$`).test(name)
  );
}

export function databaseUrl(
  env: Record<string, string | undefined>,
  database: string,
) {
  const url = new URL(env.TEST_DATABASE_URL!);
  url.pathname = `/${database}`;
  return url.toString();
}

// Mirrors how `@/db` connects, so maintenance work reaches the same server.
export function connectionConfig(
  env: Record<string, string | undefined>,
  database: string,
): ClientConfig {
  return env.DATABASE_LOCAL_SOCKET
    ? {
        host: env.DATABASE_LOCAL_SOCKET,
        database,
        // eslint-disable-next-line local/player-domain-term -- Postgres role, not a Player
        user: env.DATABASE_USER,
      }
    : { connectionString: databaseUrl(env, database) };
}

export async function withMaintenanceClient<T>(
  env: Record<string, string | undefined>,
  run: (client: Client) => Promise<T>,
) {
  const client = new Client(connectionConfig(env, baseDatabaseName(env)));
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

export function quoteIdent(name: string) {
  return `"${name.replace(/"/g, '""')}"`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
