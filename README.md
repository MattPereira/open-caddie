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

Database:

- `pnpm run db:generate` — generate a migration file
- `pnpm run db:migrate` — apply generated migrations
- `pnpm run db:studio` — open Drizzle Studio

## Environments

This is currently a solo hobby app, so the database workflow is intentionally simple:

Neon preview/dev branches can be added later if the project needs safer isolated testing, but they are not required for day-to-day solo development. The important rule now is to use reviewed migrations for normal schema changes.


## Workflow for a schema change

1. Edit `db/schema.ts` and any code that touches the affected tables.
2. Run `pnpm run db:generate`.
3. Read the generated SQL in `drizzle/`. Confirm it only does what you intend.
4. Run `pnpm run db:migrate` against the intended database.
5. Run any one-shot backfill scripts via `pnpm exec tsx scripts/<name>.ts`.
6. Run `pnpm run dev` and smoke-test the affected flow.
7. Run `pnpm run check`.
8. Commit the app changes, `db/schema.ts`, and the generated migration files together.

Do not use `drizzle-kit push` for normal schema changes. It bypasses migration history. If you deliberately need it for an emergency repair or disposable prototype, run it explicitly with `pnpm exec drizzle-kit push` so the unusual choice is visible.


## Stack

| Layer               | Choice                                                       |
| ------------------- | ------------------------------------------------------------ |
| Framework           | Next.js (App Router, Server Actions)                         |
| Language            | TypeScript                                                   |
| Database            | Neon (serverless Postgres)                                   |
| ORM                 | Drizzle + drizzle-kit                                        |
| Auth                | Auth.js v5 — Google OAuth + email magic links                |
| Email (magic links) | Resend                                                       |
| AI SDK              | Vercel AI SDK                                                |
| LLM (vision + chat) | Claude Sonnet 4.6 or GPT-4o                                  |
| Image storage       | Vercel Blob                                                  |
| Hosting             | Vercel                                                       |
| Styling             | Tailwind CSS + shadcn/ui                                     |
| Validation          | Zod (schemas for Server Actions + AI structured output)      |
