---
name: database-migrations
description: Schema changes and Drizzle migrations. Use when editing `src/db/schema.ts` or `src/db/migrations/`, running `pnpm db:generate` / `pnpm db:migrate`, a build failing `db:check-migrations`, or changing migration wiring (`vercel.json`, `drizzle.config.ts`, Neon env vars).
---

# Database migrations

Every Vercel build runs `pnpm db:migrate:checked` (`db:check-migrations`, then `db:migrate`) before `next build`: Production against Neon `production`, each Preview against `preview/<git-branch>`, a copy of `production` made on the branch's first deploy. Drizzle applies all pending migrations in one transaction; a failure rolls back, stops the build, and the previous deployment keeps serving.

## Rules

1. **Compatible with the deployed code.** The schema changes before the new code is live, and stays changed if `next build` then fails. A change it can't survive takes [expand/contract](#expandcontract).
2. **Applied migrations are frozen.** Drizzle records applied migrations by timestamp and skips an edited one, so the database drifts from the repo. `pnpm db:check-migrations` runs before `db:migrate` in every build and fails it on an edited, missing or out-of-order migration, naming the fix. Merged: write a new migration. Pushed but unmerged: you may edit it, then ask the human to reset `preview/<git-branch>` from `production` in Neon and redeploy.
3. **Existing rows survive.** A new NOT NULL column gets a default or a backfill in the same migration. Backfills and data fixes go in an idempotent custom migration: `pnpm db:generate --custom --name <what>`.

## Steps

1. Edit `src/db/schema.ts`.
2. `pnpm db:generate`, then read the new SQL in `src/db/migrations/` and put every statement through [expand/contract](#expandcontract).
3. When the new schema needs data the seed lacks, add it to `src/seed/world.ts` through module entry points.
4. `pnpm db:reset`.
5. `pnpm check`.

Done when the generated SQL passes all three rules, any follow-up is filed, step 4 succeeds, and `pnpm check` passes.

## Expand/contract

Test every statement in the generated SQL: does the code live in production now still work once it runs? Split whatever fails across deploys: each PR leaves prod working, and the rest becomes a follow-up issue.

What decides it in this repo:

- **Deployed code selects every column its `schema.ts` lists** (`db.select().from(table)`, the Auth.js adapter). A column or table leaves the database one deploy after it leaves `schema.ts`: remove it from `schema.ts` and the code, replace the generated `DROP` with `SELECT 1;`, and drop it in the follow-up with a custom `DROP ... IF EXISTS`.
- **A rename can stay in TypeScript.** Change the key and keep the database name (`newName: text("old_name")`); `db:generate` then emits nothing.
- **A backfill misses what the old code writes before the new code is live.** Where those writes matter, have the new code write both shapes until the follow-up.
- **`db:generate` asking whether a column was renamed** means the SQL is about to break deployed code.

File the follow-up with `gh issue create --blocked-by <this issue>`, carrying this issue's labels minus `agent:*`, its body opening "Start once the production deploy of #<this issue> succeeded." Without `gh` access, put its title and body in the PR body under **Follow-up**.

## Wiring

Before changing `vercel.json`, `drizzle.config.ts` or the Neon env vars, read [WIRING.md](WIRING.md).
