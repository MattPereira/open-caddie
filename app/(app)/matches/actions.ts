"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import * as mutations from "@/lib/matches/mutations";
import {
  importRoundScorecard,
  type UploadRoundScorecardState,
} from "@/lib/rounds/scorecard-import";
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
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = MatchCreateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  return mutations.createMatch(session.user.id, parsed.data);
}

export async function updateMatch(
  values: MatchUpdateValues,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = MatchUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  return mutations.updateMatch(session.user.id, parsed.data);
}

export async function deleteMatch(id: number): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  return mutations.deleteMatch(session.user.id, id);
}

export async function uploadMatchRoundScorecard(
  matchId: number,
  _state: UploadRoundScorecardState,
  formData: FormData,
): Promise<UploadRoundScorecardState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in." };

  const result = await importRoundScorecard({
    userId: session.user.id,
    eventKind: "match",
    eventId: matchId,
    formData,
  });
  if (!result.ok) return { error: result.error };
  redirect(result.redirectPath);
}
