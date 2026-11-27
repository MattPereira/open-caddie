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

In the agent workflows, the app is already running, once per database:

- the seed: `http://localhost:3000`.
- Bug Report #n's snapshot: port 3000 + n, e.g. #12 on
  `http://localhost:3012`. See `docs/agents/live-bug-report.md`.

`echo $SERVER_MODE` says how:

- `dev`, in the roles that edit code (implement, implement-spec's build,
  review): `next dev`, so your edits show without a restart. A route's first
  visit can take a few seconds while it compiles; a Bug Report's server always
  starts cold, so its first visits are the slow ones.
- `build`, in the roles that only read (explore, decompose): a build
  (`next build`, then `next start`) of the code as it was when the job
  started, not your edits.

Setup starts them and the runner stops them when the job ends. Don't start,
stop or restart a server: a dev server that dies comes back on its own,
without its cache, so its routes compile again. A server's log, crashes and
restarts included, is `/tmp/app-<port>.log`.

Don't run `pnpm build` either: it empties `.next` but for the seed's
`.next/dev`, so every Bug Report's server answers 500 until the job ends. CI
runs the build.

After adding a migration, apply it to every database. The servers pick it up
without a restart:

```bash
pnpm db:migrate                                          # the seed
DATABASE_URL="${DATABASE_URL%/*}/open_caddie_bug_12" pnpm db:migrate   # Bug Report #12
```

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
start.

**Read `/tmp/seed-routes.txt` before you look for a page.** The seed writes
it: one line per seeded page (each Tournament, Match, Club, Course, casual
Round and play page) and what it shows. Play pages 404 until you sign in as a
Scorer of that Round, e.g. `admin`. A Bug Report also has a prod snapshot: see
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

If you need a page's server HTML as a signed-in Player (what the server sent,
before React touches it), fetch it from the signed-in page. Curl has no
session, so it gets the login redirect:

```bash
agent-browser eval 'fetch("/onboarding").then(r => r.text())' | jq -r . > /tmp/onboarding.html
```

## A thing that will bite you

**Hydration lags "networkidle".** The button is in the server HTML before
React attaches its `onClick`, so a click before hydration is a silent no-op.
The app sets `data-hydrated` on `<body>` once React has hydrated, so after
every `open` or navigation, wait for it before you click or run `find`:

```bash
agent-browser open http://localhost:3000/players
agent-browser wait '[data-hydrated]'
```

Don't retry clicks or wait a fixed time instead.

`find` needs the wait too: it marks the element it matches with a
`data-agent-browser-located` attribute. Before hydration, React finds that
attribute missing from the server HTML and logs a hydration attribute
mismatch in `console`. The tool caused that, not the app.
