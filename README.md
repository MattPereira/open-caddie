# Plan

## Legacy App Context

The original app is contra-costa-golf-club, a full stack web app that lets members of the contra costa golf club enter scores for each tournament they play together.

The orginal stack is React/MUI for the frontend with Node.js/Express/PostgreSQL for the backend.

## New App Plan

The new app will be called open-caddie with a goal to be more composable and modular so users have option to record scores without the scores having to be applied to a contra costa golf club tournament.

However, open-caddie must still facilitate all the original functionality that contra-costa-golf-club app offered.

### 1. Schema design (on paper, no code)

- [ ] Sketch core tables: `players`, `courses`, `holes`, `rounds`, `scores`, `tournaments`.
- [ ] Extract from old repo: existing schema shape + handicap/points formulas. Ignore old patterns.
- [ ] Goal: a clean, normalized Postgres schema before writing a single line of code.

### 2. Project scaffold

- [x] `create-next-app` (App Router, TypeScript).
- [x] Wire up Drizzle + Neon (dev branch + prod branch).
- [x] Configure Auth.js v5 with Resend magic links.
- [ ] Configure Auth.js v5 with Google OAuth.
- [x] Push initial schema with `drizzle-kit`.

### 3. Vertical slice: manual score entry

- [ ] Auth-gated form to enter a round by hand.
- [ ] Server Action → Drizzle insert → DB.
- [ ] Basic list/detail view of rounds.
- [ ] Proves the full stack end-to-end with zero AI. Also serves as the manual fallback path.

### 4. Vertical slice: handicap & points calculation

- [ ] Port scoring math from the old app as pure functions.
- [ ] Unit tests on the formulas (these are the one place tests really pay off).
- [ ] Render a leaderboard/results table.

### 5. Vertical slice: scorecard photo upload (AI #1)

- [ ] Upload to Vercel Blob.
- [ ] Vercel AI SDK `generateObject` with vision + Zod schema for scorecard structure.
- [ ] Show parsed result side-by-side with the original photo for human confirmation before saving.
- [ ] Persist both the image URL and the parsed scores.

### 6. Vertical slice: chat over the database (AI #2)

- [ ] Vercel AI SDK `streamText` with tool-calling.
- [ ] Tools: `queryRounds`, `queryPlayers`, `queryCourses`, etc. — each hits Drizzle directly.
- [ ] No RAG, no vector store. Schema is relational, tools are the right pattern.

### 7. Course images & polish

- [ ] Course photo uploads to Vercel Blob.
- [ ] Mobile-first UI pass.
- [ ] README focused on portfolio narrative: structured-output OCR, tool-calling chat, Neon DB branching, type-safe Server Actions.

---

## Stack

| Layer               | Choice                                                       |
| ------------------- | ------------------------------------------------------------ |
| Framework           | Next.js 15 (App Router, Server Actions)                      |
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
