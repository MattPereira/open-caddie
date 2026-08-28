import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, verificationTokens } from "@/db/schema";

const LINK_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Auth.js stores the sha256 of `${token}${AUTH_SECRET}` and looks the row up by
 * that hash when the email callback runs. See @auth/core
 * `lib/actions/callback/index.js`.
 */
async function hashToken(token: string, secret: string) {
  const data = new TextEncoder().encode(`${token}${secret}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type SignInLinkResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Mints a one-time sign-in link for a player so an admin can text it to them.
 * The link redeems through the existing Resend email callback, so no extra
 * route or table is involved.
 */
export async function createSignInLink({
  userId,
  origin,
}: {
  userId: string;
  origin: string;
}): Promise<SignInLinkResult> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return { ok: false, error: "AUTH_SECRET is not set." };
  }

  const [player] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!player) {
    return { ok: false, error: "That player no longer exists." };
  }

  const email = player.email?.trim().toLowerCase();
  if (!email) {
    return { ok: false, error: "That player needs an email address first." };
  }

  const token = crypto.randomUUID().replace(/-/g, "");
  await db.insert(verificationTokens).values({
    identifier: email,
    token: await hashToken(token, secret),
    expires: new Date(Date.now() + LINK_TTL_MS),
  });

  const url = new URL("/api/auth/callback/resend", origin);
  url.searchParams.set("token", token);
  url.searchParams.set("email", email);

  return { ok: true, url: url.toString() };
}
