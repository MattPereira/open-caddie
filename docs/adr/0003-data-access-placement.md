---
status: accepted
date: 2026-07-13
---

# Data-access placement: `db/` is the Drizzle boundary, reads live in `lib/<domain>/`

`db/` holds only the Drizzle boundary — how we talk to Postgres — and nothing else:

- `db/index.ts` — the drizzle client (connection).
- `db/schema.ts` — table, enum, and view definitions.
- `db/migrations/` — generated migration SQL and the drizzle-kit journal (`out` in `drizzle.config.ts`). Kept here rather than the drizzle-kit default root `drizzle/` so the connection, schema, and migrations — the complete Drizzle surface — live in one folder.

It is off-limits to feature work unless you are changing the connection or a table definition. All application data logic lives elsewhere, placed by a single rule:

- **Reads → `lib/<domain>/queries.ts`.** Side-effect-free, `cache()`-wrapped, imported directly into Server Components. Reads are shared across many routes and have no route-boundary concerns, so they get one central per-domain home. A domain's read seam is the file named `queries.ts` (or a co-located read module such as `lib/rounds/greenies.ts` for a sub-entity).
- **Writes → the route's `actions.ts`.** A write is a route-triggered command that fuses `"use server"`, auth, input validation, the mutation, and `revalidatePath`/`redirect`. Those boundary concerns cannot cleanly leave the action, so writes stay colocated with the route that triggers them. Colocated `actions.ts` is the Next.js-endorsed convention for mutation entry points.

This extends [ADR 0002](0002-layered-shared-components.md), which already made `lib/<domain>/` the home for domain logic. Reads previously lived in `db/queries/`, creating a split-brain — some DB-touching reads were in `db/queries/`, others already in `lib/<domain>/` (`lib/matches`, the `scorecard-import` modules). Consolidating reads under `lib/<domain>/` removes that second home.

`lib/<domain>/` may therefore contain DB-touching code; `lib/` is not sacred pure-compute territory. The read/compute distinction is expressed by **filename** (`queries.ts` = the DB read seam) rather than by a folder wall — the low-ceremony rule an agent can follow without judgment.

## Considered options

- **`db/` as the full data-access layer** (connection + schema + reads + writes, e.g. `db/queries/` + `db/mutations/`) was rejected because writes are not moving out of server actions — they need `"use server"`, auth, and `revalidatePath`, which are route-boundary concerns — so a "all DB access lives in `db/`" rule would be false the moment you look at mutations. It also fights the existing dependency direction, where `db/queries/rounds.ts` already reached into `lib/handicap`.
- **Sacred pure `lib/` with a separate repository/adapter layer** (hexagonal/DDD) was rejected as over-ceremony for a single-context, single-datastore app: the extra indirection buys little and gives an agent more places to misplace code.
- **Full read/write symmetry** (thin actions + `lib/<domain>/mutations.ts`) was rejected as a speculative refactor. Splitting fat actions often makes them harder to follow (passing `userId` in, returning data for revalidation). A write's pure core is extracted to `lib/<domain>/` only on demand, as already done for `lib/matches` and `lib/handicap`.

## Schema stays single-file

`db/schema.ts` remains one file. A relational schema is one cohesive graph, not N independent domains: tables cross-reference densely and the `round_summaries` view spans four tables across three domains, so a by-domain split would strand cross-cutting objects and force arbitrary placement — the same smell ADR 0002 rejected for components. Agents locate tables by symbol search, not by folder, so a split adds import overhead without improving findability. If the file grows painful (~800–1000 lines), revisit as a `db/schema/` folder with per-domain files re-exported through a barrel `index.ts`; existing `@/db/schema` imports keep working unchanged.

## Consequences

The agent-facing placement rule is two sentences: **Reads → `lib/<domain>/queries.ts`. Writes → that route's `actions.ts`.** `db/` becomes small and stable. Read modules keep importing `@/db` and `@/db/schema` unchanged; only their location and consumers' import paths change. The fat query files (`courses`, `standings`) may later become a `queries/` folder-with-barrel if they hurt.
