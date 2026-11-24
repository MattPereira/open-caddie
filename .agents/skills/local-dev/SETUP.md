# Local database setup

Postgres 18 (`pg_dump` must be at least prod's version) and a role that can `CREATEDB`.

```bash
createdb open_caddie
createdb open_caddie_test
```

`.env.development.local`, read before `.env.local` (which `pnpm env:pull` overwrites and may hold a Neon URL) by `pnpm dev`, the `db:*` commands and drizzle-kit:

```bash
DATABASE_URL=postgresql:///open_caddie?host=/var/run/postgresql
DATABASE_DRIVER=node-postgres
PROD_READONLY_DATABASE_URL=   # the GitHub secret of the same name; only db:copy-prod reads it
```

Keep `DATABASE_URL` a URL, never `DATABASE_LOCAL_SOCKET`: `db:copy-prod` and `dev:prod` swap its database name, and the socket vars ignore it.

`.env.test`, for `pnpm test` (each worker copies `open_caddie_test`):

```bash
DATABASE_URL=postgresql:///open_caddie_test?host=/var/run/postgresql
TEST_DATABASE_URL=postgresql:///open_caddie_test?host=/var/run/postgresql
DATABASE_DRIVER=node-postgres
```

Both files are gitignored and copied into new worktrees (`.worktreeinclude`). The app's other secrets come from `pnpm env:pull` into `.env.local`.
