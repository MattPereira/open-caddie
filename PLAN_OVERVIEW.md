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

### 6. Vertical slice: course scorecard image upload (AI #1)

- [x] Vercel AI SDK `generateObject` with vision + Zod schema for scorecard structure.
- [x] UI for uploading scorecard images and allowing user to confirm tee yardages and hole pars / handicaps

### 7. Vertical slice: player scorecard image upload (AI #1)
- [ ] Vercel AI SDK `generateObject` with vision + Zod schema for scorecard structure.
- [ ] UI for uploading handwritten scorecards images and confirmation of parsed results flow
