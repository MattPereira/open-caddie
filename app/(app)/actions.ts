"use server";

import { eq } from "drizzle-orm";

import { signIn, signOut } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function signInWithEmail(
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  if (!existing) {
    return { ok: false, error: "No account found for this email." };
  }

  await signIn("resend", {
    email: normalized,
    redirect: false,
    redirectTo: "/",
  });

  return { ok: true };
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
