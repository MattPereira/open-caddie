# Giving the agent a browser

This is how you drive a page in the app, and ask it questions.

It uses [agent-browser](https://github.com/vercel-labs/agent-browser), a CLI
built for exactly this — one command per action, an answer on stdout.

## Once, per machine

```bash
npm install -g agent-browser
agent-browser install
```

On Ubuntu 23.10+, the bundled Chrome may fail to launch with
`No usable sandbox!`. AppArmor blocks the unprivileged user namespaces that
Chrome's sandbox needs. System Chrome ships an AppArmor profile that allows
them, so point agent-browser at it rather than passing `--no-sandbox`:

```bash
echo '{"executablePath": "/opt/google/chrome/chrome"}' > ~/.agent-browser/config.json
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

## Screenshots for a PR

Screenshots are PR evidence: a before and an after for a change that shows in
the UI. Name them `<slug>-before.png` and `<slug>-after.png`, save them in
`screenshots/`, then upload them:

```bash
# The path must be absolute: a relative one resolves against the
# agent-browser daemon's directory, not yours.
agent-browser screenshot "$PWD/screenshots/players-after.png"

# Prints one markdown image line per file. Paste them into the PR body.
scripts/pr-screenshots.sh screenshots/players-before.png screenshots/players-after.png
```

`screenshots/` is gitignored, so the files only exist on your machine. The script pushes them to
the `pr-screenshots` branch, an orphan branch that holds only images and is
never merged, under a folder named after your current branch. Each URL is
pinned to the upload's commit, so a later re-upload cannot change what a
reviewer already saw.

You may run `scripts/pr-screenshots.sh` without asking first. That standing
permission covers the `pr-screenshots` branch and nothing else.

To shoot both themes, set the color scheme rather than clicking the toggle:
`agent-browser set media dark` (or `light`), then reload.

## Things that will bite you

**Hydration lags "networkidle".** The button is in the server HTML before
React attaches its `onClick`, so the first click can be a silent no-op. Poll
for the click's effect and click again, rather than waiting a fixed time.

**Next.js compiles each route on its first request.** In `pnpm dev`, the
first load of a route can take seconds and may trigger a reload once it
finishes. Warm the route with a throwaway `open` before the real loop;
otherwise it lands mid-interaction and clicks hit a page that is navigating
away. The same delay applies to a click that navigates to a cold route: an
immediate `get url` still shows the old page, so poll it.

**`find` can cause a hydration error.** `find` marks the element it matches
with `data-agent-browser-located`. If it runs before hydration, React logs
"A tree hydrated but some attributes … didn't match". The tool caused that
error, not the app.

**The console buffer is shared.** The agent-browser daemon can keep messages
from another project's session. Treat `console` lines that don't match this
app (for example `[vite]`) as noise, or pass `--session <name>` to isolate
your run.
