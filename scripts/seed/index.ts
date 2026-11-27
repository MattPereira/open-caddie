import { writeFileSync } from "node:fs";

import { requireLocalDatabase } from "./local";
import { formatSeededRoutes, seedRoutesFile } from "./world/routes";

requireLocalDatabase();

// Imported only after the guard, since loading a module connects `@/db`.
const { seedWorld } = await import("./world");
const routes = formatSeededRoutes(await seedWorld());
const routesFile = seedRoutesFile(process.env);
// In CI the seed runs in a setup step whose log the agent can't read.
writeFileSync(routesFile, routes);
console.log(`Seeded the database. Its pages, also in ${routesFile}:\n`);
console.log(routes);
process.exit(0);
