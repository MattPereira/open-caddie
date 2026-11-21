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
refs), `screenshot`, `console`, `errors`, `close`. `agent-browser --help` has
the rest.

**Ask the page, do not ask the person.** A change you have not looked at is a
change you are reporting on trust.

## Data to look at

The pages need data, and it comes from the seed: a fixed world of Players,
two Courses, a Club with Tournaments, and Matches. `src/seed/world.ts` says
exactly what is in it. The agent workflows seed their database before you
start. Locally, against a local Postgres:

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
agent-browser open "$(pnpm -s db:sign-in admin@example.com)"
```

- `admin@example.com` is the Platform Admin.
- `tiger@example.com` (Tiger Woods) is an ordinary Player. Every seeded Player
  has `<key>@example.com`, keyed as in `PLAYERS` in `src/seed/world.ts`.

Each link works once. The session lasts until you `close` the browser.
`AUTH_SECRET` must be set, and the same in `pnpm db:sign-in` and the app.
`AUTH_URL` sets the link's origin (default `http://localhost:3000`). Match it
to the address `pnpm dev` printed.

## Screenshots for a PR

Screenshots are PR evidence for a change that shows in the UI: a before and an
after, each at a phone and a desktop viewport.

### What to shoot

| Shot                                                                | When                                |
| ------------------------------------------------------------------- | ----------------------------------- |
| Before and after, light, phone **390×844** and desktop **1280×800** | Every UI change                     |
| After, dark, both viewports                                         | The change touches color            |
| Both sides of a breakpoint, e.g. 1023 and 1024 wide                 | The change is about that breakpoint |
| Extra states (sorted, scrolled, signed out…)                        | The ticket names them               |

Many components render a different layout below `lg`. The phone shot is how a
reviewer sees what the change did there, even when the ticket only names the
desktop element.

Set the viewport and color scheme with commands, rather than resizing or
clicking the theme toggle:

```bash
agent-browser set viewport 390 844     # phone; 1280 800 for desktop
agent-browser set media dark           # or light; then reload
```

Frame each shot on the viewport, scrolled to the change. Use `--full` only
when the change spans the whole page: a full-page phone shot is very tall.

Name them `<slug>-<before|after>[-<variant>]-<phone|desktop|width>.png`, e.g.
`rounds-after-dark-phone.png` or `rounds-after-1023.png`.

### Laying them out

In a PR body, these dropdowns are the Evidence section's before and after.
Each state gets a collapsed `<details>` holding a table: one row per variant,
a column per viewport. The blank line after `</summary>` is required, or
GitHub renders the markdown inside as plain text.

```markdown
<details>
<summary>Before</summary>

|       | Phone (390)                                             | Desktop (1280)                                              |
| ----- | ------------------------------------------------------- | ----------------------------------------------------------- |
| Light | ![before, phone](/tmp/evidence/rounds-before-phone.png) | ![before, desktop](/tmp/evidence/rounds-before-desktop.png) |

</details>

<details>
<summary>After</summary>

|       | Phone (390)                                                     | Desktop (1280)                                                      |
| ----- | --------------------------------------------------------------- | ------------------------------------------------------------------- |
| Light | ![after, phone](/tmp/evidence/rounds-after-phone.png)           | ![after, desktop](/tmp/evidence/rounds-after-desktop.png)           |
| Dark  | ![after dark, phone](/tmp/evidence/rounds-after-dark-phone.png) | ![after dark, desktop](/tmp/evidence/rounds-after-dark-desktop.png) |

</details>
```

Each image is the `/tmp/evidence/` path in an agent workflow run, or the
uploaded URL on your machine (see below). Breakpoint shots get their own table
in the same dropdown, with a column per width.

A reviewer has no before: the PR body holds it. Shoot the PR's own after state
into one dropdown, `PR's after state`, and each UI fix into its own,
`After <sha>: <what it fixed>`. Each uses the same table.

### Uploading them

**In an agent workflow run**, you hold no GitHub token, so
`scripts/pr-screenshots.sh` cannot upload. Save each PNG in `/tmp/evidence/`
and reference it by that absolute path. The workflow uploads every PNG there
and swaps each path for its URL.

**On your machine**, save them in `screenshots/`, then upload them:

```bash
# The path must be absolute: a relative one resolves against the
# agent-browser daemon's directory, not yours.
agent-browser screenshot "$PWD/screenshots/rounds-after-phone.png"

# Prints one markdown image line per file. Put the URLs in the tables.
scripts/pr-screenshots.sh screenshots/rounds-*.png
```

`screenshots/` is gitignored, so the files only exist on your machine. The script pushes them to
the `pr-screenshots` branch, an orphan branch that holds only images and is
never merged, under a folder named after your current branch. Each URL is
pinned to the upload's commit, so a later re-upload cannot change what a
reviewer already saw.

You may run `scripts/pr-screenshots.sh` without asking first. That standing
permission covers the `pr-screenshots` branch and nothing else.

## Two things that will bite you

**Hydration lags "networkidle".** The button is in the server HTML before
React attaches its `onClick`, so the first click can be a silent no-op. Poll
for the click's effect and click again, rather than waiting a fixed time.

**Next.js compiles each route on its first request.** In `pnpm dev`, the
first load of a route can take seconds and may trigger a reload once it
finishes. Warm the route with a throwaway `open` before the real loop;
otherwise it lands mid-interaction and clicks hit a page that is navigating
away.
