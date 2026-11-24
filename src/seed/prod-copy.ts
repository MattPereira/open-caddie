import { spawn, type ChildProcess } from "node:child_process";
import type { Readable, Writable } from "node:stream";

import { assertLocalConnection } from "@/db/connection";

import { requireLocalDatabase } from "./local";
import { PROD_COPY_DATABASE, prodCopyUrl } from "./prod-copy-url";

// `pnpm db:pull-prod` copies prod into open_caddie_prod; `pnpm dev:prod` runs
// the app on it.

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

const command = process.argv[2];
if (command === "pull") await pull();
else if (command === "dev") await run("next", ["dev"], copyUrl);
else throw new Error("Usage: tsx src/seed/prod-copy.ts <pull | dev>");

async function pull() {
  const prodUrl = process.env.PROD_READONLY_DATABASE_URL;
  if (!prodUrl) {
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
  // come over empty, since they hold live Google tokens and sessions.
  await pipe(
    spawn(
      "pg_dump",
      [
        prodUrl,
        "--no-owner",
        "--no-acl",
        "--schema=public",
        "--schema=drizzle",
        "--exclude-table-data=public.account",
        "--exclude-table-data=public.session",
        '--exclude-table-data=public."verificationToken"',
      ],
      { stdio: ["ignore", "pipe", "inherit"] },
    ),
    spawn("psql", ["-q", "-o", "/dev/null", "-v", "ON_ERROR_STOP=1", copyUrl], {
      stdio: ["pipe", "inherit", "inherit"],
    }),
  );
  // Applies this branch's migrations on top of prod's.
  await run("pnpm", ["db:migrate"], copyUrl);
  console.log(`Copied prod into ${PROD_COPY_DATABASE}.`);
}

function run(cmd: string, args: string[], databaseUrl?: string) {
  const env = databaseUrl
    ? { ...process.env, DATABASE_URL: databaseUrl }
    : process.env;
  return exited(spawn(cmd, args, { stdio: "inherit", env }), cmd);
}

async function pipe(
  from: ChildProcess & { stdout: Readable },
  to: ChildProcess & { stdin: Writable },
) {
  from.stdout.pipe(to.stdin);
  await Promise.all([exited(from, "pg_dump"), exited(to, "psql")]);
}

function exited(child: ChildProcess, name: string) {
  return new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0 || signal === "SIGINT") resolve();
      else reject(new Error(`${name} exited with ${code ?? signal}`));
    });
  });
}
