---
status: accepted
date: 2026-11-13
---

# A test database per worker, not per-test rollback

DB-backed suites (`*.db.test.ts`) each run in a database of their own vitest worker, cloned from a template that is migrated once per run, and every app table is truncated before each test. We chose this over wrapping each test in a rolled-back transaction because a few suites deliberately prove the row locks: concurrent `assignRoundToPairing` calls (`modules/tournaments/tests/pairing-writes.db.test.ts`) and concurrent scorecard-import starts (`modules/courses/tests/scorecard-import.db.test.ts`) need two real connections that contend. Inside one test transaction those calls share a single connection, so they either queue (the test passes without proving the lock) or interleave savepoints (errors that come and go between runs).

## Considered Options

- **Per-test transaction rollback everywhere.** Faster, no `CREATEDB` needed, many suites can share one database. Rejected: it gives up the only tests that prove the locks work, and swapping the `@/db` singleton for a client bound to each test's transaction is no simpler to set up.
- **Rollback for most tests, real databases for the concurrency tests.** Rejected: two mechanisms, and a concurrency test put in the wrong one passes silently.
- **Lockless Pairing cap** (a `slot` column with a unique `(pairing_id, slot)`), so its concurrency test could go. Rejected: concurrent assignments pick the same free slot and one fails spuriously unless retried, and the scorecard-import test would still need real connections.

## Consequences

- Template and worker names include a random ID generated once per Vitest invocation. The configured database is only a maintenance connection: overlapping invocations and worktrees never share test data or cleanup targets. Startup does not sweep previous runs; teardown removes only its own databases. A killed run's leftovers require `pnpm test:db:cleanup <run-id>`, using the ID printed at startup. Explicit selection keeps cleanup simple without guessing whether another run is still alive. This addresses the cross-run database deletion reproduced in #292, not the separate unexpected worker exits.
- Test databases must be local (localhost or a Unix socket) and the role needs `CREATEDB`. `db/index.ts` refuses any other URL under vitest, so a test can never reach Neon.
- Revisit if the suite becomes slow enough that rollback's speed matters, or if tests have to run against a hosted database without `CREATEDB`.
