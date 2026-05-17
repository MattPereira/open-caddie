# Plan

## Legacy App Context

- contra-costa-golf-club, a full stack web app that lets members of the contra costa golf club enter scores for each tournament they play together.
- stack is React/MUI for the frontend with Node.js/Express/PostgreSQL for the backend
- express backend logic is poorly written doing a ton of calcuations that should be moved to frontend for user handicaps and round/tournament points

## New App Plan

- open-caddie will be more composable and modular so users have option to record scores without having to be applied to a contra costa golf club tournament
  - added a 'clubs' table to the db so the site supports more than just ccgc now
  - using a default 'casual' club for users to record scores that aren't supposed to be part of any club
- open-caddie must still facilitate all the original functionality that contra-costa-golf-club app offered

### 1. Schema design (on paper, no code)

- [x] Sketch core tables for new drizzle neon schema: `players`, `courses`, `holes`, `rounds`, `scores`, `tournaments`.
- [x] Push new schema design with `drizzle-kit`.
- [x] Migrate existing railway postgres ccgc database to new db on vercel neon

### 2. Project scaffold

- [x] `create-next-app` (App Router, TypeScript).
- [x] Wire up Drizzle + Neon (dev branch + prod branch).
- [x] Configure Auth.js v5 with Resend magic links.
- [x] Configure Auth.js v5 with Google OAuth.

### 3. Vertical slice: manual score entry

- [x] Auth-gated form to enter a round by hand.
- [x] Server Action → Drizzle insert → DB.
- [x] Basic list/detail view of rounds.

### 4. Vertical slice: handicap & point calculations

- [x] Extract from old repo: handicap/points formulas (look at express models and routes files)
- [x] Port scoring math from the old app as pure functions.
- [x] Render a tournament leaderboard and season standings table
- [ ] Unit tests on the formulas (these are the one place tests really pay off).

### 5. Course images and UI improvements

- [x] Course photo uploads to Vercel Blob.
- [x] Mobile-first UI pass.

### 6. Vertical slice: scorecard photo upload (AI #1)

- [ ] Upload to Vercel Blob.
- [ ] Vercel AI SDK `generateObject` with vision + Zod schema for scorecard structure.
- [ ] Show parsed result side-by-side with the original photo for human confirmation before saving.
- [ ] Persist both the image URL and the parsed scores.

### 7. Vertical slice: chat over the database (AI #2)

- [ ] Vercel AI SDK `streamText` with tool-calling.
- [ ] Tools: `queryRounds`, `queryPlayers`, `queryCourses`, etc. — each hits Drizzle directly.
- [ ] No RAG, no vector store. Schema is relational, tools are the right pattern.

### 8. Final Polish & Documentation

- [ ] README focused on portfolio narrative: structured-output OCR, tool-calling chat, Neon DB branching, type-safe Server Actions.
- [ ] Update Matt's resume with the project information

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
