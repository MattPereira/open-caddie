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
3. **A test is named after the lib file, lib subfolder or entry point it covers** (`reads.db.test.ts`, `scorecard-import.db.test.ts`, `event-rounds.db.test.ts`). `.db.test.ts` if it hits the database, `.test.ts` if not; one base name may have both. A base name that outgrows one file splits by facet: `scorecard-import.lifecycle.db.test.ts`. Not every lib file needs a test.
4. **Public reads start with `get`, `is` or `has`.** Writes use a domain verb (`createRound`, `recordScorecardChanges`).

## Why this shape

Domain code used to live in `lib/<domain>` folders where any file could import any other, so callers reached into internals and refactors spread. Alternatives considered:

- **`src/packages`**: collides with pnpm workspace packages.
- **`src/app/modules` or `src/app/_modules`**: `src/app` is the Next.js router; domain code doesn't belong there.
- **Convention without enforcement**: an agent follows a failing check more reliably than a paragraph.
- **One entry point per idea** (`player-name.ts`, `holes.ts`, …): the file names didn't say why they were split out. Most existed only to keep `@/db` out of the browser bundle, marked by `// Client-safe.` comments that nothing enforced. Naming entry points by runtime makes the build and depcruise check it.

Entry points import the db directly (no DB injection); DB-backed tests use per-worker databases ([ADR 0008](../../docs/adr/0008-per-worker-test-databases.md)). Layering and UI ownership are deferred.

## Rules

`pnpm lint:boundaries` and `pnpm lint` enforce the module rules. Both run in `pnpm check`, CI and the pre-commit hook. Each rule is defined, with a comment explaining it, in `.dependency-cruiser.cjs`, `.dependency-cruiser.runtime.cjs` (`index.ts` runs anywhere; client components run in the browser), `scripts/check-module-tests.mjs` (every module has tests) and `lint-rules/server-entry-guard.mjs` (`server.ts` starts with `import "server-only"`).

### Runtime checks

`.dependency-cruiser.runtime.cjs` follows runtime imports only (type-only imports are erased, as in the bundle) from two kinds of starting file, and fails if any path reaches `src/db/`, a module's `server.ts` or `server-only`:

- **`index-runs-anywhere`** starts from every module's `index.ts`.
- **`client-runs-in-browser`** starts from every file under `src/` whose first statement is a `"use client"` directive, wherever it lives. It catches the path the `server-only` build guard misses: a client component importing a shared helper (in `src/lib`, say) that imports the db.

A file whose first statement is `"use server"` is left out of the graph: a client component that imports a Server Action gets a server reference, not the action's code. Server components aren't checked; they may use `server.ts` freely. A failure prints the import chain, one file per line, from the client component to the server code.

Modules may import non-module code (`src/lib`, `src/db`, …). Layering (which modules may depend on which) isn't enforced yet; the config has a commented stub.
