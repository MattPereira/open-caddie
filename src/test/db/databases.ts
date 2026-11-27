import { Client, type ClientConfig } from "pg";

import {
  assertLocalConnection,
  nodePostgresConfig,
  type ConnectionEnv,
} from "@/db/connection";

export type TestEnv = ConnectionEnv;

export function baseDatabaseName(env: TestEnv) {
  return testDatabaseUrl(env).pathname.slice(1);
}

function testDatabaseUrl(env: TestEnv) {
  if (!env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is not set");
  return new URL(env.TEST_DATABASE_URL);
}

export function runDatabaseName(env: TestEnv) {
  const id = env.TEST_DATABASE_RUN_ID;
  if (!id || !/^[a-f0-9]{32}$/.test(id)) {
    throw new Error(
      "TEST_DATABASE_RUN_ID must be 32 lowercase hexadecimal characters",
    );
  }
  // A fixed prefix avoids PostgreSQL's 63-byte truncation for long base names.
  return `oc_test_${id}`;
}

export function templateName(base: string) {
  return `${base}_template`;
}

export function workerName(base: string, poolId: string) {
  return `${base}_w${poolId}`;
}

export function isTestRunDatabase(base: string, name: string) {
  return name === templateName(base) || workerNamePattern(base).test(name);
}

export function workerNamePattern(base: string) {
  return new RegExp(`^${escapeRegExp(base)}_w\\d+$`);
}

export function databaseUrl(env: TestEnv, database: string) {
  const url = testDatabaseUrl(env);
  url.pathname = `/${database}`;
  return url.toString();
}

// Every raw client the test setup opens goes through here, so the local-only
// guard applies before CREATE/DROP DATABASE, not just once `@/db` loads.
export function connectionConfig(env: TestEnv, database: string): ClientConfig {
  const config = nodePostgresConfig(env, databaseUrl(env, database), database);
  assertLocalConnection(config, env);
  return config;
}

export async function withMaintenanceClient<T>(
  env: TestEnv,
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

export async function dropRunDatabases(env: TestEnv) {
  const run = runDatabaseName(env);
  await withMaintenanceClient(env, async (client) => {
    const { rows } = await client.query<{ datname: string }>(
      "SELECT datname FROM pg_database",
    );
    for (const { datname } of rows) {
      if (isTestRunDatabase(run, datname)) {
        await client.query(
          `DROP DATABASE IF EXISTS ${quoteIdent(datname)} WITH (FORCE)`,
        );
      }
    }
  });
}

export function quoteIdent(name: string) {
  return `"${name.replace(/"/g, '""')}"`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
