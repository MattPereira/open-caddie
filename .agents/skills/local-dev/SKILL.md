---
name: local-dev
description: Running the app locally. Use when starting the dev server, pointing it at the seed or a copy of prod, signing the human in, or setting up the local databases.
---

# Local dev

The app runs on a local Postgres, never on Neon. Two databases, one per dev server command:

| Database           | Holds                   | Server         | Sign-in link                     |
| ------------------ | ----------------------- | -------------- | -------------------------------- |
| `open_caddie`      | the seed (default)      | `pnpm dev`     | `pnpm -s db:sign-in <who>`       |
| `open_caddie_prod` | a copy of prod          | `pnpm dev:prod`| `pnpm -s db:sign-in:prod <who>`  |

"Prod", "real data" or "prod db" means the copy. Everything else means the seed.

## Steps

1. **Fill the database.**
   - Seed: `pnpm db:reset` when it's empty, or pages fail on a missing column or table (another branch migrated it; every worktree shares `open_caddie`).
   - Copy: `pnpm db:copy-prod` when `open_caddie_prod` doesn't exist or the human wants it fresh. It reads prod through a read-only login and applies this branch's migrations to the copy.
2. **Start the server** in the background, and read the address it prints. Next.js runs one dev server per worktree: switching between seed and copy means stopping the running one first (`Another next dev server is already running` names its PID). Stop only a server you started; ask the human about theirs.
3. **Sign in.** Mint the link with the row's command, with `AUTH_URL` set to that address:

   ```bash
   AUTH_URL=http://localhost:3001 pnpm -s db:sign-in:prod admin
   ```

   `admin` is a Platform Admin; any other argument is an email. Each link works once, and its token lands in the row's database, so the command must match the server. Give the human the link to open; to drive the page yourself, see `docs/agents/agent-browser.md`.

Done when the server answers at its address and the human has a fresh link minted for that address.

## Setup, once per machine

A missing `DATABASE_URL` or database means setup. See [SETUP.md](SETUP.md).
