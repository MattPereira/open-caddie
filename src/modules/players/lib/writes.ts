import { revalidatePath } from "next/cache";
import { and, count, eq, ne, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { greenies, rounds, users } from "@/db/schema";
import { safeDeleteBlob } from "@/lib/images/blob";
import { pgCode } from "@/lib/pg-errors";
import { isPlatformAdmin, requirePlatformAdmin } from "./platform-admin";

// Player writes. Plain module: route actions authenticate and parse untrusted
// input, then pass the acting Player's id in (ADR 0003).

export type PlayerWriteResult = { ok: true } | { ok: false; error: string };

/** `email` is the stored address, so the caller's sign-in email matches it. */
export type PlayerCreateResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

/** Form values; blank strings mean "none". */
export type PlayerCreateInput = {
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  image: string;
  isAdmin: boolean;
};

export type PlayerUpdateInput = PlayerCreateInput & { id: string };

const IN_USE = "Email or username already in use.";

export async function createPlayer(
  actingPlayerId: string,
  values: PlayerCreateInput,
): Promise<PlayerCreateResult> {
  const admin = await requirePlatformAdmin(
    actingPlayerId,
    "Only Platform Admins can add Players.",
  );
  if (!admin.ok) return admin;

  const fields = normalize(values);
  const refused = await refuseIfTaken(fields);
  if (refused) return refused;

  try {
    await db.insert(users).values({ ...fields, isAdmin: values.isAdmin });
  } catch (e) {
    if (pgCode(e) === "23505") return { ok: false, error: IN_USE };
    throw e;
  }

  revalidatePath("/players");
  return { ok: true, email: fields.email };
}

export async function updatePlayer(
  actingPlayerId: string,
  values: PlayerUpdateInput,
): Promise<PlayerWriteResult> {
  const { id } = values;
  const canManagePlayers = await isPlatformAdmin(actingPlayerId);
  if (!canManagePlayers && actingPlayerId !== id) {
    return { ok: false, error: "You can only edit your own profile." };
  }

  const [current] = await db
    .select({ email: users.email, isAdmin: users.isAdmin, image: users.image })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!current) return { ok: false, error: "Player not found." };

  const fields = normalize(values);
  const emailChanged = current.email?.toLowerCase() !== fields.email;
  const refused = await refuseIfTaken(fields, {
    excludeId: id,
    checkEmail: emailChanged,
  });
  if (refused) return refused;

  try {
    await db
      .update(users)
      .set({
        ...fields,
        isAdmin: canManagePlayers ? values.isAdmin : current.isAdmin,
        ...(emailChanged ? { emailVerified: null } : {}),
      })
      .where(eq(users.id, id));
  } catch (e) {
    if (pgCode(e) === "23505") return { ok: false, error: IN_USE };
    throw e;
  }

  if (current.image !== fields.image) {
    await safeDeleteBlob(current.image);
  }

  revalidatePath("/players");
  revalidatePath("/clubs/[handle]", "page");
  revalidatePath(`/players/${id}`);
  return { ok: true };
}

export async function deletePlayer(
  actingPlayerId: string,
  id: string,
): Promise<PlayerWriteResult> {
  const admin = await requirePlatformAdmin(
    actingPlayerId,
    "Only Platform Admins can delete Players.",
  );
  if (!admin.ok) return admin;

  if (actingPlayerId === id) {
    return { ok: false, error: "You cannot delete your own account." };
  }

  const [[{ value: roundCount }], [{ value: greenieCount }]] =
    await Promise.all([
      db.select({ value: count() }).from(rounds).where(eq(rounds.playerId, id)),
      db
        .select({ value: count() })
        .from(greenies)
        .innerJoin(rounds, eq(greenies.roundId, rounds.id))
        .where(eq(rounds.playerId, id)),
    ]);

  if (roundCount > 0 || greenieCount > 0) {
    return {
      ok: false,
      error: `Cannot delete: player has ${roundCount} round(s) and ${greenieCount} greenie(s).`,
    };
  }

  await db.delete(users).where(eq(users.id, id));
  revalidatePath("/players");
  revalidatePath(`/players/${id}`);
  return { ok: true };
}

function normalize(values: PlayerCreateInput) {
  const firstName = emptyToNull(values.firstName);
  const lastName = emptyToNull(values.lastName);
  const full = [firstName, lastName].filter(Boolean).join(" ");
  return {
    email: values.email.trim().toLowerCase(),
    firstName,
    lastName,
    username: emptyToNull(values.username),
    image: emptyToNull(values.image),
    name: full || null,
  };
}

function emptyToNull(s: string) {
  const t = s.trim();
  return t.length > 0 ? t : null;
}

async function refuseIfTaken(
  fields: ReturnType<typeof normalize>,
  { excludeId, checkEmail = true }: { excludeId?: string; checkEmail?: boolean } = {},
): Promise<{ ok: false; error: string } | null> {
  const others = (condition: SQL) =>
    excludeId ? and(condition, ne(users.id, excludeId)) : condition;

  if (checkEmail) {
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(others(sql`lower(${users.email}) = ${fields.email}`))
      .limit(1);
    if (taken) return { ok: false, error: "That email is already in use." };
  }

  if (fields.username) {
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(others(eq(users.username, fields.username)))
      .limit(1);
    if (taken) return { ok: false, error: "That username is already in use." };
  }

  return null;
}
