"use server";

import { signIn } from "@/auth";

export async function signInWithEmail(email: string) {
  await signIn("resend", { email, redirect: false, redirectTo: "/" });
}
