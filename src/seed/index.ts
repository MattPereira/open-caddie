import { config } from "dotenv";

import { assertLocalConnection, nodePostgresConfig } from "@/db/connection";

// Same env source as `pnpm db:migrate`; variables already set win.
config({ path: ".env.local", quiet: true });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// Seeding is only ever for a local Postgres, which the app's default Neon
// driver can't reach.
process.env.DATABASE_DRIVER ??= "node-postgres";
if (process.env.DATABASE_DRIVER !== "node-postgres") {
  throw new Error("The seed needs DATABASE_DRIVER=node-postgres");
}
assertLocalConnection(
  nodePostgresConfig(process.env, url, process.env.DATABASE_NAME),
  process.env,
);

// Imported only after the guard, since loading a module connects `@/db`.
const { seedWorld } = await import("./world");
await seedWorld();
process.exit(0);
