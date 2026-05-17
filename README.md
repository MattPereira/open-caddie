# Open Caddie

A modern golf score keeper for singles, groups, and tournament play.

## Commands

App:

- `pnpm run dev` — start local dev server
- `pnpm run build` — production build
- `pnpm run start` — run the built app
- `pnpm run lint` — ESLint
- `pnpm run typecheck` — `next typegen && tsc --noEmit`
- `pnpm run check` — lint + typecheck

Database — dev branch (default, reads `.env.local`):

- `pnpm run db:push` — push schema to dev Neon branch
- `pnpm run db:generate` — generate a migration file
- `pnpm run db:migrate` — apply generated migrations
- `pnpm run db:studio` — open Drizzle Studio against dev

Database — production (reads `.env.production.local` via `dotenv-cli`):

- `pnpm run db:push:prod` — push schema to prod
- `pnpm run db:migrate:prod` — apply migrations to prod
- `pnpm run db:studio:prod` — open Drizzle Studio against prod

## Environments

> ⚠️ **TODO — dev/prod split not actually wired up yet.**
> `.env.local` currently still points at the **production `main` Neon branch**, so every local command (`pnpm run dev`, `pnpm run db:push`, any `tsx` script) hits prod. The `:prod`-suffixed scripts below exist but are functionally identical to the unsuffixed ones until this is fixed.
>
> **Plan to fix — use the Vercel-Neon integration to manage branches automatically.**
>
> The manual approach (hand-create a Neon branch, hand-copy connection strings into `.env.local`) hit a wall because the manually-created `dev` branch came up with role `MattPereira` while prod uses `neondb_owner`. Trying to reconcile roles across branches by hand is the wrong rabbit hole.
>
> Instead, let Vercel + Neon do it. The integration provisions:
> - A dedicated Neon branch per **Vercel Preview deployment** (one per PR / git branch), with matching credentials auto-injected as env vars on the preview build.
> - A separate set of env vars per Vercel **environment** (Production / Preview / Development), so local dev can pull a Development-scoped set that points at a non-prod branch.
>
> Concrete next steps when picking this back up:
>
> 1. In Vercel: Storage → the Neon integration → enable **Preview branches** (per-PR Neon branches).
> 2. In Vercel: Project Settings → Environment Variables → confirm the Postgres URLs exist for the **Development** environment and point at a non-prod Neon branch (a long-lived `dev` branch the integration creates for you, or one you bind manually).
> 3. Locally: `vercel link` (if not already linked) then `vercel env pull .env.local --environment=development`. This overwrites `.env.local` with the Development-env vars — including a working `DATABASE_URL` for the dev Neon branch with the right role.
> 4. Keep `.env.production.local` as the explicit prod copy (`vercel env pull .env.production.local --environment=production`).
> 5. Verify: `pnpm run db:studio` should hit dev, `pnpm run db:studio:prod` should hit prod. The Neon dashboard's "Compute last active" tells you which branch each command touched.
>
> After step 3, the `:prod` script suffix is the explicit speed-bump for prod-touching commands and the workflow below works as written.

Once the split is in place, two env files, both gitignored:

- `.env.local` — points `DATABASE_URL` (and the other Postgres URLs) at the **`dev` Neon branch**. Loaded automatically by `next dev`, `tsx`, and `drizzle-kit`.
- `.env.production.local` — points at the **`main` (production) Neon branch**. Only loaded when a script explicitly opts in via `dotenv -e .env.production.local --`.

Non-database secrets (auth, blob, resend, etc.) are typically the same in both files. Only the Postgres URLs differ.

## Workflow for a schema change

1. Edit `db/schema.ts` and any code that touches the affected tables.
2. `pnpm run db:push` → applies to **dev**.
3. Run any one-shot backfill scripts via `pnpm exec tsx scripts/<name>.ts` (also targets dev).
4. `pnpm run dev` → smoke-test against dev data.
5. `pnpm run check` → lint + typecheck.
6. `git commit && git push` → deploys to Vercel preview/production.
7. `pnpm run db:push:prod` → apply the same schema to **prod**. Time this so prod schema migrates just before (or simultaneously with) the prod code deploy — never long before, never after.

If the dev branch data drifts too far from prod, in the Neon console: delete the `dev` branch and recreate it from `main` (copy-on-write, takes seconds). Update `.env.local` if the connection string changes.

## Stack

| Layer               | Choice                                                       |
| ------------------- | ------------------------------------------------------------ |
| Framework           | Next.js (App Router, Server Actions)                         |
| Language            | TypeScript                                                   |
| Database            | Neon (serverless Postgres, scales to zero, branching per PR) |
| ORM                 | Drizzle + drizzle-kit                                        |
| Auth                | Auth.js v5 — Google OAuth + email magic links                |
| Email (magic links) | Resend                                                       |
| AI SDK              | Vercel AI SDK                                                |
| LLM (vision + chat) | Claude Sonnet 4.6 or GPT-4o                                  |
| Image storage       | Vercel Blob                                                  |
| Hosting             | Vercel                                                       |
| Styling             | Tailwind CSS + shadcn/ui                                     |
| Validation          | Zod (schemas for Server Actions + AI structured output)      |
