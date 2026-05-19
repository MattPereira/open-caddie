"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, ne, sql } from "drizzle-orm";
import { signIn } from "@/auth";
import { db } from "@/db";
import { clubs, greenies, rounds, users } from "@/db/schema";
import { getCurrentUser } from "@/db/queries/users";
import { safeDeleteBlob } from "@/lib/blob";
import {
  ClubCreateSchema,
  ClubUpdateSchema,
  UserCreateSchema,
  UserUpdateSchema,
  type ClubCreateValues,
  type ClubUpdateValues,
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
    .where(sql`lower(${users.email}) = ${email}`)
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
  revalidatePath("/players");
  return { ok: true };
}

export async function updateUser(
  values: UserUpdateValues,
): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = UserUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { id } = parsed.data;
  const canManageUsers = me.isAdmin;
  if (!canManageUsers && me.id !== id) {
    return { ok: false, error: "You can only edit your own profile." };
  }

  const email = parsed.data.email.toLowerCase();
  const firstName = emptyToNull(parsed.data.firstName);
  const lastName = emptyToNull(parsed.data.lastName);
  const username = emptyToNull(parsed.data.username);
  const image = parsed.data.image.length > 0 ? parsed.data.image : null;

  const [current] = await db
    .select({
      email: users.email,
      isAdmin: users.isAdmin,
      image: users.image,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!current) {
    return { ok: false, error: "User not found." };
  }

  const isAdmin = canManageUsers ? parsed.data.isAdmin : current.isAdmin;
  const emailChanged = current.email?.toLowerCase() !== email;
  const imageChanged = current.image !== image;

  if (emailChanged) {
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(sql`lower(${users.email}) = ${email}`, ne(users.id, id)))
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

  if (imageChanged) {
    await safeDeleteBlob(current.image);
  }

  revalidatePath("/admin");
  revalidatePath("/players");
  revalidatePath("/standings");
  revalidatePath(`/players/${id}`);
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
  revalidatePath("/players");
  revalidatePath(`/players/${id}`);
  return { ok: true };
}

export async function createClub(
  values: ClubCreateValues,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = ClubCreateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { handle, name, pointRules } = parsed.data;
  const logo = parsed.data.logo.length > 0 ? parsed.data.logo : null;

  try {
    await db.insert(clubs).values({ handle, name, logo, pointRules });
  } catch (e: unknown) {
    const code =
      (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (e as { code?: string })?.code;
    if (code === "23505") {
      return { ok: false, error: "A club with that handle already exists." };
    }
    throw e;
  }

  revalidatePath("/admin");
  revalidatePath("/standings");
  return { ok: true };
}

export async function updateClub(
  values: ClubUpdateValues,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = ClubUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { handle, name, pointRules } = parsed.data;
  const logo = parsed.data.logo.length > 0 ? parsed.data.logo : null;

  const [current] = await db
    .select({ handle: clubs.handle })
    .from(clubs)
    .where(eq(clubs.handle, handle))
    .limit(1);
  if (!current) {
    return { ok: false, error: "Club not found." };
  }

  await db
    .update(clubs)
    .set({ name, logo, pointRules })
    .where(eq(clubs.handle, handle));

  revalidatePath("/admin");
  revalidatePath("/standings");
  return { ok: true };
}

