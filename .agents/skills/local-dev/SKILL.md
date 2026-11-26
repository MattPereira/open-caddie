---
name: local-dev
description: Running the app on the human's machine. Use when starting the dev server, pointing it at the seed or a copy of prod, signing the human in, or setting up the local databases.
---

# Local dev

If `$SERVER_MODE` is set, you're in an agent workflow and setup already started the servers: use `docs/agents/agent-browser.md` instead.

The app runs on a local Postgres, never on Neon. Two databases, one per dev server command:

| Database           | Holds              | Server                  | Sign-in link                    |
| ------------------ | ------------------ | ----------------------- | ------------------------------- |
| `open_caddie`      | the seed (default) | `pnpm dev:agent`        | `pnpm -s db:sign-in <who>`      |
| `open_caddie_prod` | a copy of prod     | `pnpm dev:agent --prod` | `pnpm -s db:sign-in:prod <who>` |

`pnpm dev` and `pnpm dev:prod` are the human's.

"Prod", "real data" or "prod db" means the copy. Everything else means the seed.

## Steps

1. **Fill the database.**
   - Seed: `pnpm db:reset` when it's empty, or pages fail on a missing column or table (another branch migrated it; every worktree shares `open_caddie`).
   - Copy: `pnpm db:copy-prod` when `open_caddie_prod` doesn't exist or the human wants it fresh. It reads prod through a read-only login and applies this branch's migrations to the copy.
2. **Start the server** with the row's command, in the foreground, and read the address it prints. It returns once the server is ready, so it needs no `nohup` or `&`; run it again to get the address back. It runs in a memory-capped scope on a port of its own per worktree, and stops itself after 10 idle minutes. Its log is `.dev-agent/server.log`. Switching between seed and copy means `pnpm dev:agent stop` first. `Another next dev server is already running` is the human's `pnpm dev`: ask them about it.
3. **Sign in.** Mint the link with the row's command. It picks up the address of the running `dev:agent` server:

   ```bash
   pnpm -s db:sign-in:prod admin
   ```

   `admin` is a Platform Admin; any other argument is an email. Each link works once, and its token lands in the row's database, so the command must match the server. Give the human the link to open; to drive the page yourself, see `docs/agents/agent-browser.md`.

4. **Stop the server** with `pnpm dev:agent stop` when you're done checking, unless the human is still using it.

Done when the server answers at its address and the human has a fresh link minted for that address.

## Setup, once per machine

A missing `DATABASE_URL` or database means setup. See [SETUP.md](SETUP.md).
