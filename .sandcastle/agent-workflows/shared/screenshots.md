Screenshots are evidence for a change that shows in the UI. Drive the app with
agent-browser (docs/agents/agent-browser.md).

If your ticket is a Bug Report (labelled `live-bug-report`), it has its own
database, `open_caddie_bug_<n>`, holding prod as it was when it was filed. Run
the app on it to see the reporter's rows: see "Data to look at" in that doc.

### What to shoot

| Shot                                                | When                                |
| --------------------------------------------------- | ----------------------------------- |
| Light, phone **390×844** and desktop **1280×800**   | Every UI change                     |
| After, dark, both viewports                         | The change touches color            |
| Both sides of a breakpoint, e.g. 1023 and 1024 wide | The change is about that breakpoint |
| Extra states (sorted, scrolled, signed out…)        | The ticket names them               |

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

### Where to save them

Save every PNG in `/tmp/evidence/`, by absolute path:

```bash
agent-browser screenshot /tmp/evidence/rounds-after-phone.png
```

Name them `<slug>-<state>[-<variant>]-<phone|desktop|width>.png`, e.g.
`rounds-after-dark-phone.png` or `rounds-after-1023.png`.

You hold no GitHub token, so do not upload them, and leave
`scripts/pr-screenshots.sh` and `screenshots/` alone. Reference each image by
its `/tmp/evidence/` path; the workflow uploads every PNG there and swaps each
path for its URL.

### Laying them out

Each state gets a collapsed `<details>` holding a table: one row per variant,
a column per viewport. The blank line after `</summary>` is required, or
GitHub renders the markdown inside as plain text.

```markdown
<details>
<summary>After</summary>

|       | Phone (390)                                                     | Desktop (1280)                                                      |
| ----- | --------------------------------------------------------------- | ------------------------------------------------------------------- |
| Light | ![after, phone](/tmp/evidence/rounds-after-phone.png)           | ![after, desktop](/tmp/evidence/rounds-after-desktop.png)           |
| Dark  | ![after dark, phone](/tmp/evidence/rounds-after-dark-phone.png) | ![after dark, desktop](/tmp/evidence/rounds-after-dark-desktop.png) |

</details>
```

Breakpoint shots get their own table in the same dropdown, with a column per
width.
