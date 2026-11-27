import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import type { TestProject } from "vitest/node";

import {
  connectionConfig,
  dropRunDatabases,
  quoteIdent,
  runDatabaseName,
  templateName,
  withMaintenanceClient,
} from "./databases";

// Fail, never skip: a db run without a database would be a green run that
// proved nothing.
export default async function setup(project: TestProject) {
  const env = project.config.env;
  if (!env.TEST_DATABASE_URL) {
    throw new Error(
      "TEST_DATABASE_URL must be set (in the environment or .env.test) to run the db project",
    );
  }
  const template = templateName(runDatabaseName(env));
  console.log(
    `[db] Test run ${env.TEST_DATABASE_RUN_ID}; cleanup: pnpm test:db:cleanup ${env.TEST_DATABASE_RUN_ID}`,
  );

  await withMaintenanceClient(env, (client) =>
    client.query(`CREATE DATABASE ${quoteIdent(template)}`),
  );

  const templateClient = new Client(connectionConfig(env, template));
  await templateClient.connect();
  try {
    await migrate(drizzle(templateClient), {
      migrationsFolder: "./src/db/migrations",
    });
  } finally {
    // Workers clone the template, which fails while anything is connected.
    await templateClient.end();
  }

  return () => dropRunDatabases(env);
}
