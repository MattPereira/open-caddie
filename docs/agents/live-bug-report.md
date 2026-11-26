# A Bug Report's snapshot

In the agent workflows, a Bug Report (an issue labelled `live-bug-report`) has
a **snapshot**: prod as it was when the report was filed, with the branch's
migrations on top. It lives in `open_caddie_bug_<n>`, beside the seeded
database. Its app is already running, as a prod build, on port 3000 + n.
Opening a URL from the report there shows the rows the reporter saw: for issue
#12, `https://<prod host>/players/7` is `http://localhost:3012/players/7`. Don't
build, start or kill a server; see `docs/agents/agent-browser.md`.

Point `db:sign-in` at the snapshot and its server:

```bash
DATABASE_URL="${DATABASE_URL%/*}/open_caddie_bug_12" \
  AUTH_URL=http://localhost:3012 pnpm -s db:sign-in admin   # issue #12
```

- `admin` is a Platform Admin. For a Player, pass their email from the `user`
  table.
- A URL whose row is missing means the row was gone when the report was filed.
  Say so.
- Sign-in sessions and linked accounts are not copied.
- `pnpm check` runs on the seed, not the snapshot.
