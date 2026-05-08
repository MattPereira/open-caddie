"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth, unstable_update } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { slugify } from "./slugify";
import { OnboardingSchema, type OnboardingValues } from "./schema";

const MAX_USERNAME_LEN = 20;
const MAX_COLLISION_ATTEMPTS = 10;

function buildUsername(base: string, attempt: number): string {
  if (attempt === 0) return base;
  const suffix = `-${attempt + 1}`;
  const maxBase = MAX_USERNAME_LEN - suffix.length;
  return base.slice(0, maxBase).replace(/-+$/, "") + suffix;
}

export async function submitOnboarding(
  values: OnboardingValues,
): Promise<{ error: string } | void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const parsed = OnboardingSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { firstName, lastName } = parsed.data;
  const fullName = `${firstName} ${lastName}`;
  const baseSlug = slugify(firstName, lastName);

  let savedUsername: string | null = null;
  for (let attempt = 0; attempt < MAX_COLLISION_ATTEMPTS; attempt++) {
    const candidate = buildUsername(baseSlug, attempt);
    try {
      await db
        .update(users)
        .set({ username: candidate, firstName, lastName, name: fullName })
        .where(eq(users.id, session.user.id));
      savedUsername = candidate;
      break;
    } catch (e: unknown) {
      const code =
        (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
        (e as { code?: string })?.code;
      if (code !== "23505") throw e;
    }
  }

  if (!savedUsername) {
    return {
      error:
        "Couldn't generate a unique handle from your name. Try a slight variation.",
    };
  }

  await unstable_update({
    user: { username: savedUsername, firstName, lastName, name: fullName },
  });

  redirect("/");
}
