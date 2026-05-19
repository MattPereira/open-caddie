"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clubs } from "@/db/schema";
import { getCurrentUser } from "@/db/queries/users";
import {
  ClubCreateSchema,
  ClubUpdateSchema,
  type ClubCreateValues,
  type ClubUpdateValues,
} from "./schema";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const me = await getCurrentUser();
  if (!me?.isAdmin) {
    throw new Error("Forbidden");
  }
  return me;
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

  revalidatePath("/clubs");
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

  revalidatePath("/clubs");
  revalidatePath(`/clubs/${handle}`);
  revalidatePath("/standings");
  return { ok: true };
}
