import { requireLocalDatabase } from "./local";

requireLocalDatabase();

const who = process.argv[2];
if (!who) throw new Error("Usage: pnpm db:sign-in <email | admin>");

const origin = process.env.AUTH_URL ?? "http://localhost:3000";

// Imported only after the guard, since loading them connects `@/db`.
const { createSignInLinkForEmail } = await import("@/lib/auth/sign-in-link");
const { getAllPlayers } = await import("@/modules/players/server");

// The agent workflows run on a copy of prod, whose Platform Admins have real
// addresses the agent has no reason to know.
async function platformAdminEmail() {
  const admin = (await getAllPlayers()).find((p) => p.isAdmin && p.email);
  if (!admin?.email) throw new Error("No Platform Admin has an email.");
  return admin.email;
}

const email = who === "admin" ? await platformAdminEmail() : who;
const result = await createSignInLinkForEmail({ email, origin });
if (!result.ok) throw new Error(result.error);
console.log(result.url);
process.exit(0);
