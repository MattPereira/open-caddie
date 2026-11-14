import { Client, type ClientConfig } from "pg";

import {
  assertLocalConnection,
  nodePostgresConfig,
  type ConnectionEnv,
} from "@/db/connection";

// Names and connections for the db project's template and worker databases,
// all derived from the configured TEST_DATABASE_URL.

export type TestEnv = ConnectionEnv;

export function baseDatabaseName(env: TestEnv) {
  return new URL(env.TEST_DATABASE_URL!).pathname.slice(1);
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
  const url = new URL(env.TEST_DATABASE_URL!);
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

export function quoteIdent(name: string) {
  return `"${name.replace(/"/g, '""')}"`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
