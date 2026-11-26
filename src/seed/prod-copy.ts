import { spawn, type ChildProcess } from "node:child_process";

import { assertLocalConnection } from "@/db/connection";

import { requireLocalDatabase } from "./local";
import { PROD_COPY_DATABASE, prodCopyUrl } from "./prod-copy-url";

class ExitError extends Error {
  constructor(
    name: string,
    readonly code: number | null,
    readonly signal: NodeJS.Signals | null,
  ) {
    super(`${name} exited with ${code ?? signal}`);
  }
}

requireLocalDatabase();
const localUrl = process.env.DATABASE_URL ?? "";
// The socket vars connect by DATABASE_NAME and ignore the database in
// DATABASE_URL, so swapping it below would silently keep the seed.
if (process.env.DATABASE_LOCAL_SOCKET) {
  throw new Error(
    "Set DATABASE_URL as a URL (postgresql:///open_caddie?host=/var/run/postgresql), not DATABASE_LOCAL_SOCKET",
  );
}
const copyUrl = prodCopyUrl(localUrl);
assertLocalConnection({ connectionString: copyUrl }, process.env);

const [command, ...rest] = process.argv.slice(2);
if (command === "copy") await copy();
// Ctrl-C is how you stop a dev server, not a failure.
else if (command === "dev")
  await run("next", ["dev"], copyUrl).catch(ignoreInterrupt);
// The link's token has to land in the database dev:prod reads.
else if (command === "sign-in")
  await run("pnpm", ["-s", "db:sign-in", ...rest], copyUrl);
else
  throw new Error(
    "Usage: tsx src/seed/prod-copy.ts <copy | dev | sign-in [--cookie] <email | admin>>",
  );

async function copy() {
  if (!process.env.PROD_READONLY_DATABASE_URL) {
    throw new Error("PROD_READONLY_DATABASE_URL is not set");
  }
  await run("psql", [
    "-q",
    "-v",
    "ON_ERROR_STOP=1",
    localUrl,
    "-c",
    `drop database if exists ${PROD_COPY_DATABASE} with (force)`,
    "-c",
    `create database ${PROD_COPY_DATABASE}`,
  ]);
  await run("psql", ["-q", copyUrl, "-c", "drop schema public cascade"]);
  // Same dump as .github/actions/restore-bug-report-snapshots: auth tables
  // come over empty, since they hold live Google tokens and sessions. Neon
  // tags columns with a `pg_attver` option that stock Postgres rejects.
  await exited(
    spawn(
      "bash",
      [
        "-c",
        `set -o pipefail
        pg_dump "$PROD_READONLY_DATABASE_URL" --no-owner --no-acl \\
          --schema=public --schema=drizzle \\
          --exclude-table-data=public.account \\
          --exclude-table-data=public.session \\
          --exclude-table-data='public."verificationToken"' \\
          | sed '/ SET (pg_attver=[0-9]*);$/d' \\
          | psql -q -o /dev/null -v ON_ERROR_STOP=1 "$COPY_URL"`,
      ],
      { stdio: "inherit", env: { ...process.env, COPY_URL: copyUrl } },
    ),
    "pg_dump | psql",
  );
  await run("pnpm", ["db:migrate"], copyUrl);
  console.log(`Copied prod into ${PROD_COPY_DATABASE}.`);
}

function run(cmd: string, args: string[], databaseUrl?: string) {
  const env = databaseUrl
    ? { ...process.env, DATABASE_URL: databaseUrl }
    : process.env;
  return exited(spawn(cmd, args, { stdio: "inherit", env }), cmd);
}

function exited(child: ChildProcess, name: string) {
  return new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new ExitError(name, code, signal));
    });
  });
}

function ignoreInterrupt(error: unknown) {
  const interrupted =
    error instanceof ExitError &&
    (error.signal === "SIGINT" || error.code === 130);
  if (!interrupted) throw error;
}
