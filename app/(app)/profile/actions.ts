"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { auth, unstable_update } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ProfileSchema, type ProfileValues } from "./schema";

export async function updateProfile(
  values: ProfileValues,
): Promise<{ error: string } | { success: true }> {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const parsed = ProfileSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { firstName, lastName, image } = parsed.data;
  const email = parsed.data.email.toLowerCase();
  const fullName = `${firstName} ${lastName}`;
  const imageValue = image && image.length > 0 ? image : null;

  const [current] = await db
    .select({ email: users.email, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const emailChanged = current?.email?.toLowerCase() !== email;

  if (emailChanged) {
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), ne(users.id, session.user.id)))
      .limit(1);
    if (taken) {
      return { error: "That email is already in use." };
    }
  }

  try {
    await db
      .update(users)
      .set({
        firstName,
        lastName,
        name: fullName,
        image: imageValue,
        email,
        ...(emailChanged ? { emailVerified: null } : {}),
      })
      .where(eq(users.id, session.user.id));
  } catch (e: unknown) {
    const code =
      (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (e as { code?: string })?.code;
    if (code === "23505") {
      return { error: "That email is already in use." };
    }
    throw e;
  }

  await unstable_update({
    user: {
      firstName,
      lastName,
      name: fullName,
      image: imageValue,
      email,
    },
  });

  revalidatePath("/profile");
  return { success: true };
}
