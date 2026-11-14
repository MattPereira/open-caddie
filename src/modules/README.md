# Modules

Each folder here is a **deep module**: a lot of behaviour behind a small interface. A module's root files are its **entry points** (public). Everything in its subfolders is private. dependency-cruiser enforces this (`.dependency-cruiser.cjs`). See [ADR 0009](../../docs/adr/0009-domain-code-in-enforced-modules.md).

```
src/modules/
  <name>/
    index.ts        ← entry point (public). Import this from outside.
    client.ts       ← another entry point, e.g. client-safe exports.
    lib/            ← implementation. Private; files import each other freely.
    tests/          ← tests and fixtures. Private; tests use entry points only.
```

Copy [`example/`](./example) to start a new module. Modules are flat: one tier under `src/modules`, and a module never contains another module.

**Import only through a module's entry points.** Write `@/modules/season-standings`, never `@/modules/season-standings/lib/queries`.

**No barrel files.** Don't funnel a whole subtree through one `index.ts` that re-exports everything. Expose several small entry points instead (`index.ts` for server reads, `point-rules.ts` for client-safe schemas), each exporting only what callers need.

## Rules

All are `error`. Run them with `pnpm lint:boundaries`. They also run in `pnpm check` and as their own CI step.

**`entrypoint-boundary-from-app`.** Code outside `src/modules` (routes, components, `lib/`) may import a module's root files, but nothing in its subfolders.

**`entrypoint-boundary-across-modules`.** A module's own files import each other freely. They reach another module only through its entry points, never its internals.

**`tests-through-entrypoints`.** Files in `<module>/tests/` may import any module's entry points and their own `tests/` fixtures, but never any module's internals, not even their own. Tests exercise behaviour, not implementation.

**`tests-folder-is-private`.** Only tests may import from a `tests/` folder, so test fixtures never ship in app code.

**`no-circular`.** No runtime dependency cycles anywhere in `src`. Cycles that close only through `import type` edges are allowed, since types are erased at runtime.

Modules may import non-module code in `src/lib`, `src/db` and so on. Which modules may depend on which (layering) isn't enforced yet; the config has a commented stub.
