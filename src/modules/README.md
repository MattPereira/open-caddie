# Modules

Each folder here is a **deep module**: a lot of behaviour behind a small interface. A module's root files are its **entry points** (public). Everything in its subfolders is private. dependency-cruiser enforces this (`.dependency-cruiser.cjs`). Reads, writes and actions follow [CODING_STANDARDS.md](../../CODING_STANDARDS.md).

```
src/modules/
  <name>/
    index.ts        ← runs anywhere: pure logic, constants, Zod schemas, types.
    server.ts       ← server only: reads, writes, tx helpers. Starts with `import "server-only"`.
    lib/            ← implementation. Private; files import each other freely.
    tests/          ← tests and fixtures. Private; tests use entry points only.
```

## Entry points

A module has at most three entry points, named by **where they may run**:

- **`index.ts`** runs anywhere, including the browser. Import it as `@/modules/<name>`. It never reaches `@/db` or a `server.ts` at runtime; `import type` is fine, since types are erased.
- **`server.ts`** is server only. Import it as `@/modules/<name>/server`. Its first line is `import "server-only"`, so a client component that imports it fails the build. Client components may still `import type` from it.
- **`client.ts`** is browser only. None exist yet; add one only when a module gets browser-only code.

**Which file?** If the code needs the server to run (the db, the session, `next/cache`, Blob, secrets), it goes in `server.ts`. Otherwise it goes in `index.ts`, even if only server code calls it today (e.g. `computeSeasonStandings`).

No other root files. A module with no runs-anywhere code has no `index.ts`. Same pattern as `@clerk/nextjs` / `@clerk/nextjs/server`.

The split is a **bundle boundary, not caller identity**. `server.ts` means "needs the server", not "trusted callers only". If only some modules should call a function, that's a layering rule (see below), not a separate entry point.

Copy [`example/`](./example) to start a new module. Modules are flat: one tier under `src/modules`, and a module never contains another module.

**Import only through a module's entry points.** Write `@/modules/seasons/server`, never `@/modules/seasons/lib/reads`.

**No barrel files.** An entry point exports only what callers need, not everything under `lib/`.

## File names

```
lib/
  reads.ts                  ← public reads
  writes.ts                 ← public writes
  pairing-writes.ts         ← a sub-area split out of a big module
  scoring.ts                ← anything else: named after its domain idea
tests/
  reads.db.test.ts          ← same base name as the lib file it covers
  writes.db.test.ts
  scoring.test.ts
```

1. **`lib/reads.ts` and `lib/writes.ts`** hold the module's public reads and writes. Not `queries` or `mutations`. A big module may split by sub-area with a suffix: `pairing-writes.ts`, `display-round-reads.ts`.
2. **Every other lib file is named after its domain idea** (`scoring`, `handicap`, `standings`), not its role (`compute`, `impl`, `utils`).
3. **A test is named after the lib file, lib subfolder or entry point it covers** (`reads.db.test.ts`, `scorecard-import.db.test.ts`, `event-rounds.db.test.ts`). `.db.test.ts` if it hits the database, `.test.ts` if not; one base name may have both. Not every lib file needs a test.
4. **Public reads start with `get`, `is` or `has`.** Writes use a domain verb (`createRound`, `recordScorecardChanges`).

## Why this shape

Domain code used to live in `lib/<domain>` folders where any file could import any other, so callers reached into internals and refactors spread. Alternatives considered:

- **`src/packages`**: collides with pnpm workspace packages.
- **`src/app/modules` or `src/app/_modules`**: `src/app` is the Next.js router; domain code doesn't belong there.
- **Convention without enforcement**: an agent follows a failing check more reliably than a paragraph.
- **One entry point per idea** (`player-name.ts`, `holes.ts`, …): the file names didn't say why they were split out. Most existed only to keep `@/db` out of the browser bundle, marked by `// Client-safe.` comments that nothing enforced. Naming entry points by runtime makes the build and depcruise check it.

Entry points import the db directly (no DB injection); DB-backed tests use per-worker databases ([ADR 0008](../../docs/adr/0008-per-worker-test-databases.md)). Layering and UI ownership are deferred.

## Rules

All are `error`. Run them with `pnpm lint:boundaries`. They also run in `pnpm check` and as their own CI step.

**`entrypoint-boundary-from-app`.** Code outside `src/modules` (routes, components, `lib/`) may import a module's root files, but nothing in its subfolders.

**`entrypoint-boundary-across-modules`.** A module's own files import each other freely. They reach another module only through its entry points, never its internals.

**`tests-through-entrypoints`.** Files in `<module>/tests/` may import any module's entry points and their own `tests/` fixtures, but never any module's internals, not even their own. Tests exercise behaviour, not implementation.

**`tests-arrange-through-entrypoints`.** Module tests and `src/test/fixtures/` may not import anything under `src/db/`, `@/db` included. They arrange data and assert on it through entry points (`createFixtures()` wraps the common setups), so a storage change breaks only the module that owns it. The db test harness in `src/test/db/` is exempt; it seeds the first Platform Admin and holds the few things no entry point can do. An entry point may exist mainly to support tests.

**`tests-folder-is-private`.** Only tests may import from a `tests/` folder, so test fixtures never ship in app code.

**`test-support-only-from-tests`.** Fixtures shared across modules' tests (e.g. `createFixtures`) live in `src/test/fixtures/`. Only `*.test.ts` files and `src/test/` itself may import `src/test/`.

**`index-runs-anywhere`.** No runtime path from a module's `index.ts` may reach `src/db`, `server-only` or any `server.ts`. It's transitive, so it catches a pure-looking lib file that imports the db. It lives in `.dependency-cruiser.runtime.cjs`, a second pass with type-only imports erased (`reachable` rules can't skip them, and pure code legitimately type-imports server files).

**`no-circular`.** No runtime dependency cycles anywhere in `src`. Cycles that close only through `import type` edges are allowed, since types are erased at runtime.

Modules may import non-module code in `src/lib`, `src/db` and so on. Which modules may depend on which (layering) isn't enforced yet; the config has a commented stub.
