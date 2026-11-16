#!/usr/bin/env node
// Pre-commit guard: rejects source files too big for an agent to read in one go.
// Tokens are estimated as bytes / 4; stat-only, so it stays fast on any file count.
import { statSync } from "node:fs";
import { relative } from "node:path";

const MAX_TOKENS = 5000;

const oversized = process.argv
  .slice(2)
  .map((file) => ({
    file: relative(process.cwd(), file),
    tokens: Math.ceil(statSync(file).size / 4),
  }))
  .filter(({ tokens }) => tokens > MAX_TOKENS);

if (oversized.length === 0) process.exit(0);

console.error(
  `\nFiles over the ${MAX_TOKENS}-token limit (estimated as bytes / 4):\n`,
);
for (const { file, tokens } of oversized)
  console.error(`  ${file}  ~${tokens} tokens`);
console.error(`
Split each file before committing. Guidance:

- Split by responsibility, not by line count. Find the seams: groups of
  functions/components that change together and share little with the rest.
- Components: extract subcomponents (dialogs, list rows, form sections) into
  sibling files in the same _components/ folder. Move non-UI logic (state
  reducers, derived values, formatting) into a hook or a plain .ts file.
- Module code (src/modules/<name>/lib): split into sub-area files, e.g.
  reads.ts -> reads.ts + pairing-reads.ts. Keep the entry points (index.ts,
  server.ts) thin; re-export only what callers need. See src/modules/README.md.
- Long pipelines/workflows: move each step into its own file and keep the
  top-level file as the orchestrator that calls them in order.
- Tests: split by behaviour under test (one file per scenario group) and move
  shared fixtures/builders into a tests/fixtures file.
- Types/constants/schemas that bloat a file: move them to a types.ts or
  schema.ts beside it.
- Do not just shuffle code into a "utils" or "helpers" dumping ground, and do
  not minify or strip comments to slip under the limit.

After splitting, update imports, then run: pnpm lint:boundaries && pnpm typecheck
`);
process.exit(1);
