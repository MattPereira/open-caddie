# A Bug Report's snapshot

In the agent workflows, a Bug Report (an issue labelled `live-bug-report`) has
a **snapshot**: prod as it was when the report was filed, with the branch's
migrations on top. It lives in `open_caddie_bug_<n>`, beside the seeded
database. Run the app on it, and a URL from the report opens the rows the
reporter saw:

```bash
export DATABASE_URL="${DATABASE_URL%/*}/open_caddie_bug_12"   # issue #12
pnpm dev
```

- `pnpm -s db:sign-in admin` signs in as a Platform Admin. For a Player, read
  their email from the `user` table.
- A URL whose row is missing means the row was gone when the report was filed.
  Say so.
- Sign-in sessions and linked accounts are not copied.
- `pnpm check` runs on the seed, not the snapshot.
