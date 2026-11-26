import { parseArgs } from "node:util";

import { requireLocalDatabase } from "./local";
import { sessionCookieHeader } from "./session-cookie";

requireLocalDatabase();

const usage = "Usage: pnpm db:sign-in [--cookie] <email | admin>";
const { values, positionals } = parseArgs({
  options: { cookie: { type: "boolean", default: false } },
  allowPositionals: true,
});
if (positionals.length !== 1) throw new Error(usage);
const [who] = positionals;
const printCookie = values.cookie;

const origin = process.env.AUTH_URL ?? "http://localhost:3000";

// Imported only after the guard, since loading them connects `@/db`.
const { createSignInLinkForEmail } = await import("@/lib/auth/sign-in-link");
const { getAllPlayers } = await import("@/modules/players/server");

// A copy of prod (a Bug Report snapshot, `pnpm db:copy-prod`) has Platform
// Admins with real addresses the agent has no reason to know.
async function platformAdminEmail() {
  const admin = (await getAllPlayers()).find(
    (p) => p.isPlatformAdmin && p.email,
  );
  if (!admin?.email) throw new Error("No Platform Admin has an email.");
  return admin.email;
}

// Redeeming the link on the server, rather than encoding the JWT here, runs
// the real Auth.js callback, so the cookie name and claims can't drift.
async function redeem(url: string) {
  const response = await fetch(url, { redirect: "manual" }).catch((cause) => {
    throw new Error(`No server is answering at AUTH_URL (${origin}).`, {
      cause,
    });
  });
  try {
    return sessionCookieHeader(response.headers.getSetCookie());
  } catch (cause) {
    throw new Error(
      `The server at AUTH_URL (${origin}) rejected the sign-in link. Does it share this AUTH_SECRET and database?`,
      { cause },
    );
  }
}

const email = who === "admin" ? await platformAdminEmail() : who;
const result = await createSignInLinkForEmail({ email, origin });
if (!result.ok) throw new Error(result.error);
console.log(printCookie ? await redeem(result.url) : result.url);
process.exit(0);
