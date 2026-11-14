// @ts-check
// Deep-module enforcement for dependency-cruiser.
//
// Each folder under the modules root is a DEEP MODULE: a lot of behaviour
// behind a small interface. A module's PUBLIC SURFACE is its ENTRY POINTS:
// the files at the module root. Implementation lives in SUBFOLDERS and is
// private (by convention `lib/` for implementation and `tests/` for tests,
// though any subfolder is private). A module may expose several small entry
// points (index.ts, client.ts, server.ts, …); prefer that over one giant
// barrel index.
//
// The only thing you should ever need to edit here is MODULES_ROOT.

/** Where modules live. One immediate child dir per module (flat, no nesting). */
const MODULES_ROOT = "src/modules";

// --- derived patterns (no need to edit) -------------------------------------
const R = MODULES_ROOT;
/**
 * A module's private internals: anything nested inside a module subfolder.
 * The module's root files are its entry points and are NOT matched here:
 * they stay importable from outside.
 */
const MODULE_INTERNALS = `^${R}/[^/]+/[^/]+/`;

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "entrypoint-boundary-from-app",
      comment:
        "App/root code may import a module's entry points (its root files), but nothing inside its subfolders.",
      severity: "error",
      from: { pathNot: `^${R}/` }, // importer is NOT inside any module
      to: { path: MODULE_INTERNALS },
    },
    {
      name: "entrypoint-boundary-across-modules",
      comment:
        "A module's own files import each other freely, but may reach OTHER modules only through their entry points, never their internals.",
      severity: "error",
      // importer is inside a module ($1), but is not a test file
      from: { path: `^${R}/([^/]+)/`, pathNot: `^${R}/[^/]+/tests/` },
      to: {
        path: MODULE_INTERNALS,
        pathNot: `^${R}/$1/`, // same module → intra-module freedom
      },
    },
    {
      name: "tests-through-entrypoints",
      comment:
        "A module's tests exercise it through its entry points like everyone else: they may import any module's entry points and their own tests/ fixtures, but never any module's internals, not even their own.",
      severity: "error",
      from: { path: `^${R}/([^/]+)/tests/` }, // a test file, in module $1
      to: {
        path: MODULE_INTERNALS,
        pathNot: `^${R}/$1/tests/`, // own tests/ fixtures → allowed
      },
    },
    {
      name: "tests-folder-is-private",
      comment:
        "A module's tests/ folder is reachable only from tests: nothing else may import fixtures.",
      severity: "error",
      from: { pathNot: `^${R}/[^/]+/tests/` }, // importer is not itself a test
      to: { path: `^${R}/[^/]+/tests/` },
    },
    {
      name: "no-circular",
      comment: "No runtime dependency cycles (type-only edges are ignored). Scope to `^${R}/` if you want to allow cycles outside modules.",
      severity: "error",
      from: {},
      // Type-only edges are erased at runtime, so cycles through them are harmless.
      to: { circular: true, viaOnly: { dependencyTypesNot: ["type-only"] } },
    },

    // --- Layering (optional, off by default) ----------------------------------
    // Interface-hiding controls HOW you import (through the entry points).
    // Layering controls WHICH modules may depend on which. Add your own rules
    // here, e.g.:
    //
    // {
    //   name: "ui-may-not-depend-on-billing",
    //   severity: "error",
    //   from: { path: `^${R}/ui/` },
    //   to:   { path: `^${R}/billing/` },
    // },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    // Without this, TypeScript elides type-only and unused imports before
    // dependency-cruiser sees them, so boundary violations can pass silently.
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
    },
  },
};
