---
name: database-migrations
description: Schema changes and Drizzle migrations. Use when planning a schema change, editing `src/db/schema.ts` or `src/db/migrations/`, a build or CI failing `db:check-migrations` / `db:check-breaking`, or changing migration wiring (`vercel.json`, `drizzle.config.ts`, Neon env vars).
---

# Database migrations

Every Vercel build runs `pnpm db:migrate:checked` (`db:check-migrations`, then `db:migrate`) before `next build`: Production against Neon `production`, each Preview against `preview/<git-branch>`, a copy of `production` made on the branch's first deploy. Drizzle applies all pending migrations in one transaction; a failure rolls back, stops the build, and the previous deployment keeps serving.

## Rules

1. **Compatible with the deployed code.** The schema changes before the new code is live, and stays changed if `next build` then fails. A [breaking statement](#breaking-statements) ships split across deploys.
2. **Applied migrations are frozen.** Drizzle records applied migrations by timestamp and skips an edited one, so the database drifts from the repo. `db:check-migrations` fails the build on an edited, missing or out-of-order migration and names the fix. Merged: write a new migration. Pushed but unmerged: you may edit it, then ask the human to reset `preview/<git-branch>` from `production` in Neon and redeploy.
3. **Existing rows survive.** A new NOT NULL column gets a default or a backfill in the same migration. Backfills and data fixes go in an idempotent custom migration: `pnpm db:generate --custom --name <what>`.

## Planning a schema change

Classify the change against [Breaking statements](#breaking-statements) before filing anything:

- Additive: one issue.
- A rename only the code needs: a TS-only rename (`newName: text("old_name")`), one issue.
- Otherwise: a **chain**: expand, switch, contract for a rename or type change ([EXPAND-CONTRACT.md](EXPAND-CONTRACT.md)), or the two steps its row of [Breaking statements](#breaking-statements) names.

Write the first step (expand, or a two-step chain's code change) concretely. Write each later step at the level of **intent**: what it drops or removes, and its done-when checks, in terms of behaviour and schema, since the earlier step's code does not exist yet. File the parent, then each step in order, each blocked by the one before:

```sh
set -eo pipefail
issue_number() { gh issue create "$@" | sed 's|.*/||'; }
parent=$(issue_number --title "<the change>" --body "<the change and its chain>")
expand=$(issue_number --parent "$parent" --label expand-contract \
  --title "Expand: <...>" --body "<expand>")
switch=$(issue_number --parent "$parent" --blocked-by "$expand" --label expand-contract \
  --title "Switch: <...>" --body "Starts once the production deploy of #$expand succeeded.

<switch, as intent>")
contract=$(issue_number --parent "$parent" --blocked-by "$switch" --label expand-contract \
  --title "Contract: <...>" --body "Starts once the production deploy of #$switch succeeded.

<contract, as intent>")
```

A two-step chain drops `switch` and blocks its second step on `$expand`.

Show the human the filed chain: the parent and every step, with its blocker. Once they confirm it, label the first step only: `gh issue edit <first step> --add-label agent:implement`. `expand-contract.yml` starts each later step once its blockers' PRs are in production, and the review merges a clean step's PR ([ADR 0009](../../../docs/adr/0009-expand-contract-starts-on-deploy.md)).

Done when every step is filed under the parent with its blocker and `expand-contract` label, and the first step carries `agent:implement` after the human's confirmation.

## Implementing a change

The issue is the change's whole scope. When it turns out wrong (it needs more, or a later step's intent no longer fits), say so in the PR body's Summary (`pr` skill) for the reviewer to flag.

1. Edit `src/db/schema.ts`.
2. `pnpm db:generate`, then classify every statement in the new SQL against [Breaking statements](#breaking-statements). `db:generate` asking whether a column was renamed means it is about to emit a `RENAME`. A step of a rename or type change: read [EXPAND-CONTRACT.md](EXPAND-CONTRACT.md) for what the step contains.
3. When the new schema needs data the seed lacks, add it to `scripts/seed/world.ts` through module entry points.
4. **Live code, new schema.** Apply the migration to the local database (`pnpm db:migrate`), then run `origin/main`'s code against it: `git worktree add ../open-caddie-live origin/main`, copy the `.env*.local` files in, `pnpm install` and `pnpm dev` there, sign in per the `local-dev` skill, and use every page that reads the changed tables. Remove the worktree after.
5. `pnpm db:reset`.
6. `pnpm check` and `pnpm db:check-breaking`.
7. Commit and open a PR whose body follows the `pr` skill and says `Closes #<this issue>`: `gh pr create`, or in a factory run (`/tmp/ticket.md` exists) write the body to `/tmp/pr-body.md` and the workflow opens it.

Done when every statement is classified, each breaking one is split or carries a checked `deploy-safe` reason, and steps 4–7 pass.

## Breaking statements

CI's `pnpm db:check-breaking` runs [squawk](https://squawkhq.com) on migrations new to the branch, with the rules in `.squawk.toml`:

| Statement (squawk rule) | Why live code breaks | Ship it as |
| --- | --- | --- |
| `DROP COLUMN`, `DROP TABLE`, `DROP VIEW` (`ban-drop-*`) | Live code selects every column its `schema.ts` lists (`db.select().from(table)`, the Auth.js adapter). | Remove it from `schema.ts` and the code, replace the generated `DROP` with `SELECT 1;`, and drop it in the chain's next step with a custom `DROP ... IF EXISTS`. |
| `RENAME` (`renaming-column`, `renaming-object`) | Live code uses the old name. | Rename in TypeScript only (`newName: text("old_name")`, which generates nothing), or [expand/contract](EXPAND-CONTRACT.md) to rename the column itself. |
| `ALTER COLUMN ... TYPE` (`changing-column-type`) | Live code reads and writes the old type. | [Expand/contract](EXPAND-CONTRACT.md). |
| `SET NOT NULL`, `DROP DEFAULT` (`adding-not-nullable-field`, `ban-drop-default`) | Live code inserts rows without the column. | Ship code that always writes the column (and backfill nulls), then the constraint in the chain's next step. |

New tables, new nullable or defaulted columns, new indexes and `DROP NOT NULL` ship in one PR.

A flagged statement the live code does survive (a contract step after its switch deployed, a default no live insert relies on) gets its reason and squawk's ignore on the lines above it:

```sql
-- deploy-safe: contract of #<parent>, switch deployed
-- squawk-ignore ban-drop-column
ALTER TABLE "user" DROP COLUMN IF EXISTS "isAdmin";
```

The reason is a claim for the PR reviewer: write it once you have checked it. squawk reads the ignore line as rule names only, so the reason gets its own line.

## Wiring

Before changing `vercel.json`, `drizzle.config.ts` or the Neon env vars, read [WIRING.md](WIRING.md).
