import { Client } from "pg";

import { requireLocalDatabase } from "./local";

// Empties the database so `pnpm db:migrate` and `pnpm db:seed` start over.
// drizzle-kit keeps its migration journal in the `drizzle` schema; leaving it
// would make migrate skip every migration.
const client = new Client(requireLocalDatabase());
await client.connect();
try {
  await client.query(`
    drop schema if exists drizzle cascade;
    drop schema if exists public cascade;
    create schema public;
  `);
} finally {
  await client.end();
}
console.log("Emptied the database.");
