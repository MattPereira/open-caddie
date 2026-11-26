# Giving the agent a browser

This is how you drive a page in the app, and ask it questions.

It uses [agent-browser](https://github.com/vercel-labs/agent-browser), a CLI
built for exactly this — one command per action, an answer on stdout. Its
docs: https://agent-browser.dev/introduction.

## Once, per machine

```bash
npm install -g agent-browser
agent-browser install
```

## Asking your own question

In the agent workflows, the app is already running, as a prod build
(`next build`, then `next start`), once per database:

- the seed: `http://localhost:3000`.
- Bug Report #n's snapshot: port 3000 + n, e.g. #12 on
  `http://localhost:3012`. See `docs/agents/live-bug-report.md`.

Setup starts them and the runner stops them when the job ends. Don't build,
start or kill a server. They run the code as it was when the job started, not
your edits. A server's log is `/tmp/app-<port>.log`.

Locally, start the app with `pnpm dev` and use the address it printed.

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

Icon buttons have no text, so `find label` misses them. Use their
`aria-label`: `click '[aria-label="Add match"]'`.

The console buffer is shared across sessions, so `console` can show another
project's lines, such as `[vite]`. Pass `--session <name>` to every command,
or run `console --clear` before the action you are checking.

`screenshot` needs an absolute path: a relative one resolves against the
agent-browser daemon's directory, not yours.

**Ask the page, do not ask the person.** A change you have not looked at is a
change you are reporting on trust.

## Data to look at

The pages need data, and it comes from the seed: a fixed, fictional world of
Players, six Courses, two Clubs with Past and Current Seasons of Tournaments,
and Matches. `src/seed/world.ts` says
exactly what is in it. The agent workflows seed their database before you
start. A Bug Report also has a prod snapshot: see
`docs/agents/live-bug-report.md`.

Locally, `pnpm db:reset` empties, migrates and seeds it. The `local-dev`
skill has the databases, the dev servers and the sign-in links.

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

`ava@example.com` (Ava Lindqvist) is an ordinary Player. Every seeded Player
but one has `<key>@example.com`, keyed as in `PLAYERS` in `src/seed/world.ts`.

Each link works once. The session lasts until you `close` the browser.
`AUTH_SECRET` must be set, and the same in `pnpm db:sign-in` and the app.
`AUTH_URL` sets the link's origin, and must be the address of the server
you open it on. It defaults to `http://localhost:3000`, the seed's server; a
Bug Report's snapshot has its own, in `docs/agents/live-bug-report.md`.

## A thing that will bite you

**Hydration lags "networkidle".** The button is in the server HTML before
React attaches its `onClick`, so the first click can be a silent no-op. Poll
for the click's effect and click again, rather than waiting a fixed time.
