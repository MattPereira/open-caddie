---
status: accepted
date: 2026-07-13
---

# Data-access placement: `src/db/` is the Drizzle boundary, reads live in `src/lib/<domain>/`

> **Migrating domains:** for a domain already in `src/modules/<name>`, read `lib/<domain>/` below as that module, and follow the 2026-11-13 amendment. The `lib/<domain>/` paths apply only to domains not yet migrated (#126).

`src/db/` holds only the Drizzle boundary — how we talk to Postgres — and nothing else:

- `src/db/index.ts` — the drizzle client (connection).
- `src/db/schema.ts` — table, enum, and view definitions.
- `db/migrations/` — generated migration SQL and the drizzle-kit journal (`out` in `drizzle.config.ts`). Kept at the repository root to preserve migration history and tooling paths while application code lives under `src/`.

It is off-limits to feature work unless you are changing the connection or a table definition. All application data logic lives elsewhere, placed by a single rule:

- **Reads → `lib/<domain>/queries.ts`.** Side-effect-free, `cache()`-wrapped, imported directly into Server Components. Reads are shared across many routes and have no route-boundary concerns, so they get one central per-domain home. A domain's read seam is the file named `queries.ts` (or a co-located read module such as `lib/rounds/greenies.ts` for a sub-entity).
- **Writes enter through the route's `actions.ts`.** An action is the entry point: `"use server"`, `auth()` for the session, zod parsing of untrusted input, a call into the write, and `redirect`. Colocated `actions.ts` is the Next.js-endorsed convention for mutation entry points. A simple single-path write may live entirely in its action.
- **A write moves to a module in `lib/<domain>/` once it has two or more entry points, or once it carries policy beyond "signed in / Platform Admin".** Two entry points might be several actions, an import, or a page gate. Policy here means authorization rules, cross-row invariants, or which pages to invalidate. The extracted module takes the acting Player's id as an argument, owns authorization and invalidation, and is **never** `"use server"`. Every export of a `"use server"` file is a public endpoint, so a client could pass any Player id it liked. See Amendments.

`lib/<domain>/` was already the home for domain logic. Reads previously lived in `db/queries/`, creating a split-brain — some DB-touching reads were in `db/queries/`, others already in `lib/<domain>/` (`lib/matches`, the `scorecard-import` modules). Consolidating reads under `lib/<domain>/` removes that second home.

`lib/<domain>/` may therefore contain DB-touching code; `lib/` is not sacred pure-compute territory. The read/compute distinction is expressed by **filename** (`queries.ts` = the DB read seam) rather than by a folder wall — the low-ceremony rule an agent can follow without judgment.

## Considered options

- **`db/` as the full data-access layer** (connection + schema + reads + writes, e.g. `db/queries/` + `db/mutations/`) was rejected because writes are not moving out of server actions — they need `"use server"`, auth, and `revalidatePath`, which are route-boundary concerns — so a "all DB access lives in `db/`" rule would be false the moment you look at mutations. It also fights the existing dependency direction, where `db/queries/rounds.ts` already reached into `lib/handicap`.
- **Sacred pure `lib/` with a separate repository/adapter layer** (hexagonal/DDD) was rejected as over-ceremony for a single-context, single-datastore app: the extra indirection buys little and gives an agent more places to misplace code.
- **Full read/write symmetry** (a blanket `lib/<domain>/mutations.ts` for every domain, with thin actions everywhere) is still rejected as speculative. Writes move to `lib/` only when the extraction trigger above fires.

## Consequences

The agent-facing placement rule: **Reads → `lib/<domain>/queries.ts`. Writes enter through that route's `actions.ts`; once a write has a second entry point or carries policy, it moves to a plain (non-`"use server"`) module in `lib/<domain>/` that takes the acting Player's id.** `src/db/` stays small and stable. Read modules keep importing `@/db` and `@/db/schema` unchanged; only their location and consumers' import paths change. The fat query files (`courses`, `standings`) may later become a `queries/` folder-with-barrel if they hurt.

## Amendments

**2026-11-13: domain code moves into modules ([ADR 0009](./0009-domain-code-in-enforced-modules.md)).** `lib/<domain>` is migrating into `src/modules/<name>`, one slice at a time (#126). The rules above still apply inside a module, but the seam moves:

- **Reads** live in the module's private `lib/` (e.g. `lib/queries.ts`) and are exported from an entry point. The read seam is the **entry point** (`@/modules/<name>`), not a file named `queries.ts`. The filename rule above applies only to unmigrated `lib/<domain>`.
- **Extracted writes** live in the module's private `lib/` and are exported from the same server entry point. They are still plain (never `"use server"`), take the acting Player's id first, own authorization and invalidation, and return `{ ok: true } | { ok: false; error }`.
- **Writes still enter via the route's `actions.ts`**: session, zod parsing, `redirect`, and request-only work such as headers or sending sign-in email. The extraction trigger is unchanged.
- **Callers import entry points only.** `pnpm lint:boundaries` fails a deep import.

Examples: `src/modules/season-standings` (reads), `src/modules/players` (reads and extracted writes).

**2026-11-12: application source under `src/` (#109).** Connection and schema move to `src/db/`; generated migrations remain at root `db/migrations/`. This supersedes the original single-folder Drizzle layout. `drizzle.config.ts` connects the two paths. Application `lib/` and route paths in this ADR are relative to `src/`; placement rules and `@/db` imports remain unchanged.

**2026-11-06: write extraction trigger.** The original rule kept every write in its action. It assumed authorization and `revalidatePath` were route-boundary concerns. They aren't: `revalidatePath` works from any server module, and "who may write this" and "which pages show this" are domain knowledge. Keeping them in actions caused the very drift this ADR set out to prevent. Round scorecard writes had four conflicting access policies and six hand-copied revalidation lists that had drifted apart. Tests were placed where the missing modules should be (`lib/rounds/write-access.test.ts`, `lib/tournaments/mutations.test.ts`), so they had to drive actions while mocking `@/auth`. The original argument against splitting, "passing `userId` in", turned out to be the testability gain: a module that takes the Player id is tested without mocking auth. Authentication, parsing and `redirect` stay in the action. Round scorecard writes and Round write access are the first modules extracted under this trigger.
