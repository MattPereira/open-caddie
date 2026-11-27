#!/usr/bin/env node
// Rejects a module under src/modules/ with no tests/*.test.ts. dependency-cruiser
// checks imports, not whether files exist, so this runs beside it in lint:boundaries.
import { readdirSync } from "node:fs";
import { join } from "node:path";

const MODULES = "src/modules";

const subfolders = (dir) =>
  readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

const hasTest = (name) => {
  const tests = join(MODULES, name, "tests");
  try {
    return readdirSync(tests).some((file) => file.endsWith(".test.ts"));
  } catch {
    return false;
  }
};

const untested = subfolders(MODULES).filter((name) => !hasTest(name));

if (untested.length === 0) process.exit(0);

console.error("\nModules with no tests/*.test.ts:\n");
for (const name of untested) console.error(`  ${MODULES}/${name}/`);
console.error(`
Every module ships with tests. Add at least one under <module>/tests/, named
after the lib file or entry point it covers (see src/modules/README.md).
`);
process.exit(1);
