# Giving the agent a browser

This is how you drive a page in the app, and ask it questions.

It uses [agent-browser](https://github.com/vercel-labs/agent-browser), a CLI
built for exactly this — one command per action, an answer on stdout.

## Once, per machine

```bash
npm install -g agent-browser
agent-browser install
```

## Asking your own question

Start the app with `pnpm dev` first. The examples below use
`http://localhost:3000`, the Next.js dev server's default address — if
`pnpm dev` printed a different one, use that.

A screenshot is pixels. To verify a fix you need a yes or a no, so read the
DOM:

```bash
agent-browser open http://localhost:3000/players
agent-browser find placeholder "Search players..." fill "smith"

# How many player cards are left?
agent-browser get count 'a[href^="/players/"]'

# What does the empty state say, if there is one?
agent-browser get text main

# Did anything break?
agent-browser errors
agent-browser console
```

The commands worth knowing: `open`, `click`, `fill`,
`find <role|text|label|placeholder> …`, `wait`, `get text|html|attr|count|url`,
`is visible|enabled|checked`, `eval`, `snapshot` (the accessibility tree, with
refs), `screenshot`, `set viewport <w> <h>`, `set media dark|light`,
`console`, `errors`, `close`. `agent-browser --help` has the rest.

`screenshot` needs an absolute path: a relative one resolves against the
agent-browser daemon's directory, not yours.

**Ask the page, do not ask the person.** A change you have not looked at is a
change you are reporting on trust.

## Data to look at

The pages need data, and it comes from the seed: a fixed world of Players,
two Courses, a Club with Tournaments, and Matches. `src/seed/world.ts` says
exactly what is in it. The agent workflows seed their database before you
start. A Bug Report also has a prod snapshot: see
`docs/agents/live-bug-report.md`.

Locally, against a local Postgres:

```bash
pnpm db:migrate && pnpm db:seed   # an empty database
pnpm db:reset                     # start over: empty, migrate, seed
```

**Never write rows with SQL.** When a page needs data the seed lacks, add it
to `src/seed/world.ts` through module entry points, in the same change, then
`pnpm db:reset`. That keeps every screenshot reproducible.

`db:seed`, `db:reset` and `db:sign-in` refuse any database that isn't local.

## Signing in

Sign-in normally goes through an email link or Google. You have neither, so
mint the email link yourself and open it:

```bash
agent-browser open "$(pnpm -s db:sign-in admin)"   # a Platform Admin
```

`tiger@example.com` (Tiger Woods) is an ordinary Player. Every seeded Player
has `<key>@example.com`, keyed as in `PLAYERS` in `src/seed/world.ts`.

Each link works once. The session lasts until you `close` the browser.
`AUTH_SECRET` must be set, and the same in `pnpm db:sign-in` and the app.
`AUTH_URL` sets the link's origin (default `http://localhost:3000`). Match it
to the address `pnpm dev` printed.

## Two things that will bite you

**Hydration lags "networkidle".** The button is in the server HTML before
React attaches its `onClick`, so the first click can be a silent no-op. Poll
for the click's effect and click again, rather than waiting a fixed time.

**Next.js compiles each route on its first request.** In `pnpm dev`, the
first load of a route can take seconds and may trigger a reload once it
finishes. Warm the route with a throwaway `open` before the real loop;
otherwise it lands mid-interaction and clicks hit a page that is navigating
away.
