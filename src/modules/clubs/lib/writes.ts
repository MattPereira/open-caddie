import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { clubs } from "@/db/schema";
import { invalidateHomeEventsCache } from "@/lib/home/cache";
import { pgCode } from "@/lib/pg-errors";
import { requirePlatformAdmin } from "@/modules/players";
import type { PointRules } from "../point-rules";

// Club writes. Plain module: route actions authenticate and parse untrusted
// input, then pass the acting Player's id in (ADR 0003).

export type ClubWriteResult = { ok: true } | { ok: false; error: string };

/** Form values; a blank `logo` means none. Update finds the Club by `handle`, which can't change. */
export type ClubWriteInput = {
  handle: string;
  name: string;
  logo: string;
  pointRules: PointRules;
};

export async function createClub(
  actingPlayerId: string,
  values: ClubWriteInput,
): Promise<ClubWriteResult> {
  const admin = await requirePlatformAdmin(
    actingPlayerId,
    "Only Platform Admins can add Clubs.",
  );
  if (!admin.ok) return admin;

  try {
    await db.insert(clubs).values(normalize(values));
  } catch (e) {
    if (pgCode(e) === "23505") {
      return { ok: false, error: "A club with that handle already exists." };
    }
    throw e;
  }

  revalidateClubPages();
  return { ok: true };
}

export async function updateClub(
  actingPlayerId: string,
  values: ClubWriteInput,
): Promise<ClubWriteResult> {
  const admin = await requirePlatformAdmin(
    actingPlayerId,
    "Only Platform Admins can edit Clubs.",
  );
  if (!admin.ok) return admin;

  const { handle, name, logo, pointRules } = normalize(values);
  const updated = await db
    .update(clubs)
    .set({ name, logo, pointRules })
    .where(eq(clubs.handle, handle))
    .returning({ id: clubs.id });
  if (updated.length === 0) return { ok: false, error: "Club not found." };

  invalidateHomeEventsCache();
  revalidateClubPages();
  return { ok: true };
}

function normalize(values: ClubWriteInput) {
  return { ...values, logo: values.logo.length > 0 ? values.logo : null };
}

function revalidateClubPages() {
  revalidatePath("/clubs");
  revalidatePath("/clubs/[handle]", "page");
}
