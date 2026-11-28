import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { Client } from "pg";
import { expect, it } from "vitest";
import type { TestProject } from "vitest/node";

import {
  connectionConfig,
  databaseUrl,
  dropRunDatabases,
  quoteIdent,
  runDatabaseName,
  templateName,
  withMaintenanceClient,
  workerName,
} from "./databases";
import setup from "./global-setup";

it("starting and finishing another invocation preserves an active worker", async () => {
  const maintenance = `oc_lifecycle_${randomBytes(8).toString("hex")}`;
  const env = {
    ...process.env,
    TEST_DATABASE_URL: databaseUrl(process.env, maintenance),
  };
  const first = {
    ...env,
    TEST_DATABASE_RUN_ID: randomBytes(16).toString("hex"),
  };
  const second = {
    ...env,
    TEST_DATABASE_RUN_ID: randomBytes(16).toString("hex"),
  };
  const firstName = runDatabaseName(first);
  const secondName = runDatabaseName(second);
  let finishFirst: (() => Promise<void>) | undefined;
  let finishSecond: (() => Promise<void>) | undefined;
  let worker: Client | undefined;

  await withMaintenanceClient(process.env, (client) =>
    client.query(`CREATE DATABASE ${quoteIdent(maintenance)}`),
  );
  try {
    finishFirst = await setup({
      config: { env: first },
    } as unknown as TestProject);
    const { rowCount } = await withMaintenanceClient(env, (client) =>
      client.query("SELECT 1 FROM pg_database WHERE datname = $1", [
        templateName(firstName),
      ]),
    );
    expect(rowCount).toBe(1);
    await withMaintenanceClient(env, (client) =>
      client.query(
        `CREATE DATABASE ${quoteIdent(workerName(firstName, "1"))} TEMPLATE ${quoteIdent(templateName(firstName))}`,
      ),
    );
    worker = new Client(connectionConfig(env, workerName(firstName, "1")));
    await worker.connect();
    await worker.query("CREATE TABLE isolation_marker (value text)");
    await worker.query("INSERT INTO isolation_marker VALUES ('first run')");

    finishSecond = await setup({
      config: { env: second },
    } as unknown as TestProject);
    await withMaintenanceClient(env, (client) =>
      client.query(
        `CREATE DATABASE ${quoteIdent(workerName(secondName, "1"))} TEMPLATE ${quoteIdent(templateName(secondName))}`,
      ),
    );
    await finishSecond();
    finishSecond = undefined;

    expect(
      (await worker.query("SELECT value FROM isolation_marker")).rows,
    ).toEqual([{ value: "first run" }]);
    const { rows } = await withMaintenanceClient(env, (client) =>
      client.query("SELECT datname FROM pg_database WHERE datname = ANY($1)", [
        [templateName(secondName), workerName(secondName, "1")],
      ]),
    );
    expect(rows).toEqual([]);
  } finally {
    await worker?.end();
    await finishSecond?.();
    await finishFirst?.();
    await withMaintenanceClient(process.env, (client) =>
      client.query(`DROP DATABASE ${quoteIdent(maintenance)} WITH (FORCE)`),
    );
  }
}, 60_000);

it("explicit cleanup removes only the selected run", async () => {
  const first = {
    ...process.env,
    TEST_DATABASE_RUN_ID: randomBytes(16).toString("hex"),
  };
  const second = {
    ...process.env,
    TEST_DATABASE_RUN_ID: randomBytes(16).toString("hex"),
  };
  const firstName = runDatabaseName(first);
  const secondName = runDatabaseName(second);
  const names = [
    templateName(firstName),
    workerName(firstName, "1"),
    templateName(secondName),
    workerName(secondName, "1"),
  ];
  const survivor = new Client(
    connectionConfig(second, workerName(secondName, "1")),
  );
  try {
    await withMaintenanceClient(process.env, async (client) => {
      for (const name of names)
        await client.query(`CREATE DATABASE ${quoteIdent(name)}`);
    });
    await survivor.connect();
    const { stdout } = await promisify(execFile)(
      "pnpm",
      ["test:db:cleanup", first.TEST_DATABASE_RUN_ID],
      { env: process.env, timeout: 20_000 },
    );
    expect(stdout).toContain(first.TEST_DATABASE_RUN_ID);
    const { rows } = await withMaintenanceClient(process.env, (client) =>
      client.query<{ datname: string }>(
        "SELECT datname FROM pg_database WHERE datname = ANY($1) ORDER BY datname",
        [names],
      ),
    );
    expect(rows.map((row) => row.datname)).toEqual([
      templateName(secondName),
      workerName(secondName, "1"),
    ]);
    expect((await survivor.query("SELECT 42 AS answer")).rows).toEqual([
      { answer: 42 },
    ]);
  } finally {
    await survivor.end();
    await dropRunDatabases(first);
    await dropRunDatabases(second);
  }
}, 30_000);
