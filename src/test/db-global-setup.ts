import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import type { TestProject } from "vitest/node";

import {
  baseDatabaseName,
  connectionConfig,
  isRunDatabase,
  quoteIdent,
  templateName,
  withMaintenanceClient,
} from "./test-databases";

// Fail, never skip: a db run without a database would be a green run that
// proved nothing.
export default async function setup(project: TestProject) {
  const env = project.config.env;
  if (!env.TEST_DATABASE_URL) {
    throw new Error(
      "TEST_DATABASE_URL must be set (in the environment or .env.test) to run the db project",
    );
  }
  const base = baseDatabaseName(env);
  const template = templateName(base);

  // Also clears databases left behind by a run that crashed before teardown.
  await dropRunDatabases(env, base);
  await withMaintenanceClient(env, (client) =>
    client.query(`CREATE DATABASE ${quoteIdent(template)}`),
  );

  const templateClient = new Client(connectionConfig(env, template));
  await templateClient.connect();
  try {
    await migrate(drizzle(templateClient), {
      migrationsFolder: "./db/migrations",
    });
  } finally {
    // Workers clone the template, which fails while anything is connected.
    await templateClient.end();
  }

  return () => dropRunDatabases(env, base);
}

async function dropRunDatabases(
  env: Record<string, string | undefined>,
  base: string,
) {
  await withMaintenanceClient(env, async (client) => {
    const { rows } = await client.query<{ datname: string }>(
      "SELECT datname FROM pg_database",
    );
    for (const { datname } of rows) {
      if (isRunDatabase(base, datname)) {
        await client.query(
          `DROP DATABASE IF EXISTS ${quoteIdent(datname)} WITH (FORCE)`,
        );
      }
    }
  });
}
