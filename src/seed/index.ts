import { requireLocalDatabase } from "./local";

requireLocalDatabase();

// Imported only after the guard, since loading a module connects `@/db`.
const { seedWorld } = await import("./world");
await seedWorld();
console.log("Seeded the database.");
process.exit(0);
