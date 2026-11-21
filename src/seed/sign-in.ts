import { requireLocalDatabase } from "./local";

requireLocalDatabase();

const email = process.argv[2];
if (!email) throw new Error("Usage: pnpm db:sign-in <email>");

const origin = process.env.AUTH_URL ?? "http://localhost:3000";

// Imported only after the guard, since loading it connects `@/db`.
const { createSignInLinkForEmail } = await import("@/lib/auth/sign-in-link");
const result = await createSignInLinkForEmail({ email, origin });
if (!result.ok) throw new Error(result.error);
console.log(result.url);
process.exit(0);
