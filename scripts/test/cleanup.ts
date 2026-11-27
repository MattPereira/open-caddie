import { config as loadEnv } from "dotenv";

import { dropRunDatabases } from "../../src/test/db/databases";

const [runId, ...extra] = process.argv.slice(2);
if (!runId || extra.length) {
  throw new Error("Usage: pnpm test:db:cleanup <run-id>");
}

loadEnv({ path: ".env.test", quiet: true });
await dropRunDatabases({ ...process.env, TEST_DATABASE_RUN_ID: runId });
console.log(`Cleaned test run ${runId}.`);
