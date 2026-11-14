"use server";

import { getSignedInPlayer } from "@/modules/players";
import * as lifecycle from "@/lib/rounds/lifecycle";
import * as scorecardWrites from "@/lib/rounds/scorecard-writes";
import {
  RoundConfigSchema,
  RoundGreenieDeleteSchema,
  RoundGreenieSchema,
  RoundScorecardChangesSchema,
  RoundScoreSchema,
  RoundSettingsSchema,
  type RoundConfigValues,
  type RoundGreenieDeleteValues,
  type RoundGreenieValues,
  type RoundScorecardChangesValues,
  type RoundScoreValues,
  type RoundSettingsValues,
} from "./schema";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function createRound(
  values: RoundConfigValues,
): Promise<{ ok: true; roundId: number } | { ok: false; error: string }> {
  const actor = await getSignedInPlayer();
  if (!actor) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = RoundConfigSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  return lifecycle.createRound(actor.id, parsed.data);
}

export async function deleteRound(roundId: number): Promise<ActionResult> {
  const actor = await getSignedInPlayer();
  if (!actor) {
    return { ok: false, error: "You must be signed in." };
  }

  return lifecycle.deleteRound(actor.id, roundId);
}

export async function changeRoundSettings(
  values: RoundSettingsValues,
): Promise<ActionResult> {
  const actor = await getSignedInPlayer();
  if (!actor) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = RoundSettingsSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { roundId, teeId, playerIndexOverride } = parsed.data;
  return scorecardWrites.changeRoundSettings(actor.id, roundId, {
    teeId,
    playerIndexOverride: playerIndexOverride === "" ? null : playerIndexOverride,
  });
}

export async function recordRoundScorecardChanges(
  values: RoundScorecardChangesValues,
): Promise<ActionResult> {
  const actor = await getSignedInPlayer();
  if (!actor) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = RoundScorecardChangesSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { roundId, scores, greenies } = parsed.data;
  return scorecardWrites.recordScorecardChanges(actor.id, {
    scores: scores.map((score) => ({ roundId, ...score })),
    greenies: greenies.map((greenie) => ({ roundId, ...greenie })),
  });
}

export async function upsertRoundScore(
  values: RoundScoreValues,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getSignedInPlayer();
  if (!actor) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = RoundScoreSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  return scorecardWrites.recordScorecardChanges(actor.id, {
    scores: [parsed.data],
  });
}

export async function upsertRoundGreenie(
  values: RoundGreenieValues,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getSignedInPlayer();
  if (!actor) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = RoundGreenieSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { roundId, hole, feet, inches } = parsed.data;
  return scorecardWrites.recordScorecardChanges(actor.id, {
    greenies: [{ roundId, hole, distance: { feet, inches } }],
  });
}

export async function deleteRoundGreenie(
  values: RoundGreenieDeleteValues,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getSignedInPlayer();
  if (!actor) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = RoundGreenieDeleteSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { roundId, hole } = parsed.data;
  return scorecardWrites.recordScorecardChanges(actor.id, {
    greenies: [{ roundId, hole, distance: null }],
  });
}
