"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, ne } from "drizzle-orm";
import { signIn } from "@/auth";
import { db } from "@/db";
import { greenies, rounds, users } from "@/db/schema";
import { getCurrentUser } from "@/db/queries/users";
import {
  UserCreateSchema,
  UserUpdateSchema,
  type UserCreateValues,
  type UserUpdateValues,
} from "./schema";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const me = await getCurrentUser();
  if (!me?.isAdmin) {
    throw new Error("Forbidden");
  }
  return me;
}

function emptyToNull(s: string) {
  const t = s.trim();
  return t.length > 0 ? t : null;
}

function buildName(firstName: string | null, lastName: string | null) {
  const full = [firstName, lastName].filter(Boolean).join(" ").trim();
  return full.length > 0 ? full : null;
}

export async function createUser(
  values: UserCreateValues,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = UserCreateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const email = parsed.data.email.toLowerCase();
  const firstName = emptyToNull(parsed.data.firstName);
  const lastName = emptyToNull(parsed.data.lastName);
  const username = emptyToNull(parsed.data.username);
  const image = parsed.data.image.length > 0 ? parsed.data.image : null;
  const { isAdmin } = parsed.data;

  const [emailTaken] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (emailTaken) {
    return { ok: false, error: "That email is already in use." };
  }

  if (username) {
    const [usernameTaken] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    if (usernameTaken) {
      return { ok: false, error: "That username is already in use." };
    }
  }

  try {
    await db.insert(users).values({
      email,
      firstName,
      lastName,
      username,
      image,
      isAdmin,
      name: buildName(firstName, lastName),
    });
  } catch (e: unknown) {
    const code =
      (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (e as { code?: string })?.code;
    if (code === "23505") {
      return { ok: false, error: "Email or username already in use." };
    }
    throw e;
  }

  await signIn("resend", { email, redirect: false, redirectTo: "/" });

  revalidatePath("/admin");
  return { ok: true };
}

export async function updateUser(
  values: UserUpdateValues,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = UserUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { id, isAdmin } = parsed.data;
  const email = parsed.data.email.toLowerCase();
  const firstName = emptyToNull(parsed.data.firstName);
  const lastName = emptyToNull(parsed.data.lastName);
  const username = emptyToNull(parsed.data.username);
  const image = parsed.data.image.length > 0 ? parsed.data.image : null;

  const [current] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!current) {
    return { ok: false, error: "User not found." };
  }

  const emailChanged = current.email?.toLowerCase() !== email;

  if (emailChanged) {
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), ne(users.id, id)))
      .limit(1);
    if (taken) {
      return { ok: false, error: "That email is already in use." };
    }
  }

  if (username) {
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.username, username), ne(users.id, id)))
      .limit(1);
    if (taken) {
      return { ok: false, error: "That username is already in use." };
    }
  }

  try {
    await db
      .update(users)
      .set({
        email,
        firstName,
        lastName,
        username,
        image,
        isAdmin,
        name: buildName(firstName, lastName),
        ...(emailChanged ? { emailVerified: null } : {}),
      })
      .where(eq(users.id, id));
  } catch (e: unknown) {
    const code =
      (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (e as { code?: string })?.code;
    if (code === "23505") {
      return { ok: false, error: "Email or username already in use." };
    }
    throw e;
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteUser(id: string): Promise<ActionResult> {
  const me = await requireAdmin();

  if (me.id === id) {
    return { ok: false, error: "You cannot delete your own account." };
  }

  const [{ value: roundCount }] = await db
    .select({ value: count() })
    .from(rounds)
    .where(eq(rounds.userId, id));

  const [{ value: greenieCount }] = await db
    .select({ value: count() })
    .from(greenies)
    .innerJoin(rounds, eq(greenies.roundId, rounds.id))
    .where(eq(rounds.userId, id));

  if (roundCount > 0 || greenieCount > 0) {
    return {
      ok: false,
      error: `Cannot delete: user has ${roundCount} round(s) and ${greenieCount} greenie(s).`,
    };
  }

  await db.delete(users).where(eq(users.id, id));
  revalidatePath("/admin");
  return { ok: true };
}
