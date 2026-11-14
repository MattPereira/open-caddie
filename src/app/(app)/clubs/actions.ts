"use server";

import * as clubs from "@/modules/clubs";
import { getSignedInPlayer } from "@/modules/players";
import { ClubFormSchema, type ClubFormValues } from "./schema";

const SIGNED_OUT = { ok: false, error: "You must be signed in." } as const;

export async function createClub(
  values: ClubFormValues,
): Promise<clubs.ClubWriteResult> {
  const actor = await getSignedInPlayer();
  if (!actor) return SIGNED_OUT;

  const parsed = ClubFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  return clubs.createClub(actor.id, parsed.data);
}

export async function updateClub(
  values: ClubFormValues,
): Promise<clubs.ClubWriteResult> {
  const actor = await getSignedInPlayer();
  if (!actor) return SIGNED_OUT;

  const parsed = ClubFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  return clubs.updateClub(actor.id, parsed.data);
}
