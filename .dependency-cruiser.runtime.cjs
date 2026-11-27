// @ts-check
// Runtime-only rules: a second pass with type-only imports erased, as the
// bundler sees them. `reachable` can't skip type-only edges, and pure code
// legitimately type-imports server files (e.g. `import type { MatchFormat }
// from "@/db/schema"`), so these rules can't live in .dependency-cruiser.cjs.

/* oxlint-disable typescript/no-require-imports -- CJS config file */
const base = require("./.dependency-cruiser.cjs");
const {
  exactPaths,
  filesWithDirective,
} = require("./scripts/checks/directive-files.cjs");

const R = "src/modules";

/** @param {string} directive */
const filesMarked = (directive) =>
  exactPaths(filesWithDirective("src", directive));

const SERVER_ONLY_CODE = [
  "^src/db/",
  `^${R}/[^/]+/server\\.ts$`,
  "node_modules/server-only/",
];

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "index-runs-anywhere",
      comment:
        "A module's index.ts runs anywhere, including the browser: no runtime path from it may reach the db, server-only, or any module's server.ts.",
      severity: "error",
      from: { path: `^${R}/[^/]+/index\\.ts$` },
      to: { path: SERVER_ONLY_CODE, reachable: true },
    },
    {
      name: "client-runs-in-browser",
      comment:
        'A "use client" file is bundled into the browser, with everything it imports at runtime: no runtime path from it may reach the db, server-only, or any module\'s server.ts, not even through a shared helper.',
      severity: "error",
      from: { path: filesMarked("use client") },
      to: { path: SERVER_ONLY_CODE, reachable: true },
    },
  ],
  options: {
    ...base.options,
    tsPreCompilationDeps: false,
    // A "use server" file reaches the browser as a server reference, not as
    // its code, so the server code behind a Server Action is no runtime path.
    exclude: { path: filesMarked("use server") },
  },
};
