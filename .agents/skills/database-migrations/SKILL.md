---
name: database-migrations
description: Schema changes and Drizzle migrations. Use when editing `src/db/schema.ts` or `src/db/migrations/`, or running `pnpm db:generate` / `pnpm db:migrate`.
---

# Database migrations

## Where migrations run

Every Vercel build runs `pnpm db:migrate` before `next build`, against the Neon branch its environment uses:

- **Production** migrates `production`.
- **Preview** migrates `preview/<git-branch>`, copied from `production` on the Git branch's first deploy and deleted once it merges. A preview is your migration's rehearsal on prod data.

Drizzle applies every pending migration in one transaction. A failure rolls back, the build stops, and the previous deployment keeps serving.

Your own database depends on where you run:

- **Factory run**: a local Postgres holding the seed. `pnpm db:reset` empties, migrates and reseeds it; it refuses any database that isn't local.
- **Interactive session**: `.env.local` points at Neon `vercel-dev`, a copy of prod that can't be reseeded. `pnpm db:migrate` migrates it.
- **Tests**: each worker migrates its own database (ADR 0008). Nothing to do.

## Rules

1. **A migration works with the code already deployed.** The schema changes before the new code is live, and if `next build` fails after migrating, the old code keeps serving on the new schema. So a rename or drop takes two PRs: the first adds the new shape and moves every read and write to it; the second removes the old shape once nothing reads it.
2. **A merged migration is frozen.** Prod has recorded it, and drizzle only compares timestamps, so prod would silently skip an edit and drift from the repo. Change it with a new migration. A pushed, unmerged migration is recorded on its preview branch the same way: after editing one, ask the human to reset `preview/<git-branch>` from `production` in Neon and redeploy.
3. **Existing rows survive.** A new NOT NULL column gets a default or a backfill in the same migration. Backfills and data fixes are SQL in a custom migration (`pnpm db:generate --custom --name <what>`), written idempotent.

## Steps

1. Edit `src/db/schema.ts`.
2. `pnpm db:generate`, then read the new SQL in `src/db/migrations/`. It says what you intended and drops or renames nothing the deployed code reads.
3. Apply it:
   - Factory run: `pnpm db:reset`. When the new schema needs data the seed lacks, add it to `src/seed/world.ts` through module entry points, in the same change.
   - Interactive session: `pnpm db:migrate`.
4. `pnpm check`.

Done when the generated SQL matches your intent under all three rules, step 3 succeeds, and `pnpm check` passes.

## When `vercel-dev` drifts

`vercel-dev` keeps every migration applied to it, including ones later edited or abandoned, and falls behind prod as other PRs merge. Ask the human to reset `vercel-dev` from its parent (`production`) in Neon; its connection string stays the same. Then `pnpm db:migrate` to reapply your branch's unmerged migrations.

## Wiring

For changes to `vercel.json`, `drizzle.config.ts` or the Neon env vars:

- The build passes `DATABASE_URL_UNPOOLED` in as `DATABASE_URL`, because drizzle-kit can fail over the pooler. It isn't a fallback in `drizzle.config.ts`: that file loads `.env.local`, whose unpooled URL would win and migrate the wrong database.
- Only env var scoping protects prod. Prod's URLs are set by hand and scoped to Production; nothing else stops a preview build migrating prod.
- Neon's Vercel integration injects each preview's URLs. Without them, the preview build fails.
- Nothing locks against concurrent migrations: two production builds close together fail loudly on the second.
