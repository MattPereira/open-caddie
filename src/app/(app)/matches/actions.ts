"use server";

import { redirect } from "next/navigation";

import { getSignedInPlayer } from "@/modules/players";
import * as mutations from "@/lib/matches/mutations";
import {
  roundScorecardImports,
  type UploadRoundScorecardState,
} from "@/modules/rounds/scorecard-import";
import {
  MatchCreateSchema,
  MatchUpdateSchema,
  type MatchCreateValues,
  type MatchUpdateValues,
} from "./schema";

type ActionResult = { ok: true; id?: number } | { ok: false; error: string };

export async function createMatch(
  values: MatchCreateValues,
): Promise<ActionResult> {
  const actor = await getSignedInPlayer();
  if (!actor) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = MatchCreateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  return mutations.createMatch(actor.id, parsed.data);
}

export async function updateMatch(
  values: MatchUpdateValues,
): Promise<ActionResult> {
  const actor = await getSignedInPlayer();
  if (!actor) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = MatchUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  return mutations.updateMatch(actor.id, parsed.data);
}

export async function deleteMatch(id: number): Promise<ActionResult> {
  const actor = await getSignedInPlayer();
  if (!actor) {
    return { ok: false, error: "You must be signed in." };
  }

  return mutations.deleteMatch(actor.id, id);
}

export async function uploadMatchRoundScorecard(
  matchId: number,
  _state: UploadRoundScorecardState,
  formData: FormData,
): Promise<UploadRoundScorecardState> {
  const actor = await getSignedInPlayer();
  if (!actor) return { error: "You must be signed in." };

  const result = await roundScorecardImports.importRoundScorecard({
    playerId: actor.id,
    eventKind: "match",
    eventId: matchId,
    formData,
  });
  if (!result.ok) return { error: result.error };
  redirect(result.redirectPath);
}
