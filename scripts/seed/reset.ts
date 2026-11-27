import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

import { requireLocalDatabase } from "./local";

// Migrates here rather than through `pnpm db:migrate`: drizzle-kit connects
// with DATABASE_URL alone, which can differ from the socket connection the
// guard checked.
const client = new Client(requireLocalDatabase());
await client.connect();
try {
  // drizzle keeps its migration journal in the `drizzle` schema; leaving it
  // would make migrate skip every migration.
  await client.query(`
    drop schema if exists drizzle cascade;
    drop schema if exists public cascade;
    create schema public;
  `);
  await migrate(drizzle({ client }), { migrationsFolder: "src/db/migrations" });
} finally {
  await client.end();
}
console.log("Emptied and migrated the database.");
