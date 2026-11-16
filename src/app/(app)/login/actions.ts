"use server";

import { signIn, signOut } from "@/auth";
import { hasPlayerWithEmail } from "@/modules/players/server";

export async function signInWithEmail(
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase();
  if (!(await hasPlayerWithEmail(normalized))) {
    return { ok: false, error: "No account found for this email." };
  }

  await signIn("resend", {
    email: normalized,
    redirect: false,
    redirectTo: "/",
  });

  return { ok: true };
}

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
