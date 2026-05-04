"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/auth";

export async function signInWithEmail(email: string) {
  await signIn("resend", { email, redirect: false });
  redirect(`/auth/verify-request?email=${encodeURIComponent(email)}`);
}
