# Open Caddie

A modern golf application for match play and tournament coordination

- Organize clubs with tournament events and season long standings
- Set up match play for two to four players with customizable rules
- Skins games with customizable rules
- Dictate scores verbally during a round for yourself and friends
- Upload scorecard image to automatically add new course data for tees, and pars, handicaps.
- Upload handwritten scores to automatically populate a round


## Schema Changes

1. Edit `db/schema.ts` and any code that touches the affected tables.
2. Run `pnpm run db:generate`.
3. Read the generated SQL in `drizzle/`. Confirm it only does what you intend.
4. Run `pnpm run db:migrate` against the intended database.
5. Run any one-shot backfill scripts via `pnpm exec tsx scripts/<name>.ts`.
6. Run `pnpm run dev` and smoke-test the affected flow.
7. Run `pnpm run check`.
8. Commit the app changes, `db/schema.ts`, and the generated migration files together.


## Stack

| Layer               | Choice                                                       |
| ------------------- | ------------------------------------------------------------ |
| Framework           | Next.js (App Router, Server Actions)                         |
| Database            | Neon (serverless Postgres)                                   |
| ORM                 | Drizzle + drizzle-kit                                        |
| Auth                | Auth.js v5 — Google OAuth + email magic links                |
| Image storage       | Vercel Blob                                                  |
| Hosting             | Vercel                                                       |
| AI Workflows        | Vercel AI SDK + AI Gateway                                   |
| Styling             | Tailwind CSS + shadcn/ui                                     |
