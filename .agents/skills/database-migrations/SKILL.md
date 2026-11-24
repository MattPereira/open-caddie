---
name: database-migrations
description: Schema changes and Drizzle migrations. Use when editing `src/db/schema.ts` or `src/db/migrations/`, running `pnpm db:generate` / `pnpm db:migrate`, a build or CI failing `db:check-migrations` / `db:check-breaking`, or changing migration wiring (`vercel.json`, `drizzle.config.ts`, Neon env vars).
---

# Database migrations

Every Vercel build runs `pnpm db:migrate:checked` (`db:check-migrations`, then `db:migrate`) before `next build`: Production against Neon `production`, each Preview against `preview/<git-branch>`, a copy of `production` made on the branch's first deploy. Drizzle applies all pending migrations in one transaction; a failure rolls back, stops the build, and the previous deployment keeps serving.

## Rules

1. **Compatible with the deployed code.** The schema changes before the new code is live, and stays changed if `next build` then fails. A [breaking statement](#breaking-statements) ships split across deploys.
2. **Applied migrations are frozen.** Drizzle records applied migrations by timestamp and skips an edited one, so the database drifts from the repo. `pnpm db:check-migrations` runs before `db:migrate` in every build and fails it on an edited, missing or out-of-order migration, naming the fix. Merged: write a new migration. Pushed but unmerged: you may edit it, then ask the human to reset `preview/<git-branch>` from `production` in Neon and redeploy.
3. **Existing rows survive.** A new NOT NULL column gets a default or a backfill in the same migration. Backfills and data fixes go in an idempotent custom migration: `pnpm db:generate --custom --name <what>`.

## Steps

1. Edit `src/db/schema.ts`.
2. `pnpm db:generate`, then classify every statement in the new SQL against [Breaking statements](#breaking-statements). A rename or type change: follow [EXPAND-CONTRACT.md](EXPAND-CONTRACT.md) from here.
3. When the new schema needs data the seed lacks, add it to `src/seed/world.ts` through module entry points.
4. **Live code, new schema.** Apply the migration to the local database (`pnpm db:migrate`), then run `origin/main`'s code against it: `git worktree add ../open-caddie-live origin/main`, copy the `.env*.local` files in, `pnpm install` and `pnpm dev` there, sign in per the `local-dev` skill, and use every page that reads the changed tables. Remove the worktree after.
5. `pnpm db:reset`.
6. `pnpm check` and `pnpm db:check-breaking`.

Done when every statement is classified, each breaking one is split or carries a checked `deploy-safe` reason, any follow-up is filed, step 4's pages work, step 5 succeeds, and step 6 passes.

## Breaking statements

A statement is breaking when the code live in production can't survive it. CI's `pnpm db:check-breaking` flags these in migrations new to the branch:

| Statement | Why live code breaks | Ship it as |
| --- | --- | --- |
| `DROP COLUMN`, `DROP TABLE` | Live code selects every column its `schema.ts` lists (`db.select().from(table)`, the Auth.js adapter). | Remove it from `schema.ts` and the code, replace the generated `DROP` with `SELECT 1;`, and drop it in a follow-up with a custom `DROP ... IF EXISTS`. |
| `RENAME` | Live code uses the old name. | Rename in TypeScript only (`newName: text("old_name")`, which generates nothing), or [expand/contract](EXPAND-CONTRACT.md) to rename the column itself. |
| `ALTER COLUMN ... TYPE` | Live code reads and writes the old type. | [Expand/contract](EXPAND-CONTRACT.md). |
| `SET NOT NULL`, `DROP DEFAULT` | Live code inserts rows without the column. | Ship code that always writes the column (and backfill nulls), then the constraint in a follow-up. |

New tables, new nullable or defaulted columns, new indexes and `DROP NOT NULL` ship in one PR. `db:generate` asking whether a column was renamed means it is about to emit a `RENAME`.

A flagged statement the live code does survive (a contract step after its switch deployed, a default no live insert relies on) gets `-- deploy-safe: <reason>` on the line above it. The reason is a claim for the PR reviewer: write it once you have checked it.

File each follow-up with `gh issue create --blocked-by <this issue>`, carrying this issue's labels minus `agent:*`, its body opening "Start once the production deploy of #<this issue> succeeded." File only the next step; its own run files the one after. Without `gh` access, put its title and body in the PR body under **Follow-up**.

## Wiring

Before changing `vercel.json`, `drizzle.config.ts` or the Neon env vars, read [WIRING.md](WIRING.md).
