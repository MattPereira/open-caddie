// @ts-check
// Runtime-only rules: a second pass with type-only imports erased, as the
// bundler sees them. `reachable` can't skip type-only edges, and pure code
// legitimately type-imports server files (e.g. `import type { MatchFormat }
// from "@/db/schema"`), so these rules can't live in .dependency-cruiser.cjs.

const base = require("./.dependency-cruiser.cjs");

const R = "src/modules";

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "index-runs-anywhere",
      comment:
        "A module's index.ts runs anywhere, including the browser: no runtime path from it may reach the db, server-only, or any module's server.ts.",
      severity: "error",
      from: { path: `^${R}/[^/]+/index\\.ts$` },
      to: {
        path: [
          "^src/db/",
          `^${R}/[^/]+/server\\.ts$`,
          "node_modules/server-only/",
        ],
        reachable: true,
      },
    },
  ],
  options: { ...base.options, tsPreCompilationDeps: false },
};
