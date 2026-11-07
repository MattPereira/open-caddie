"use server";

import { auth } from "@/auth";
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
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = RoundConfigSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  return lifecycle.createRound(session.user.id, parsed.data);
}

export async function deleteRound(roundId: number): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  return lifecycle.deleteRound(session.user.id, roundId);
}

export async function changeRoundSettings(
  values: RoundSettingsValues,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = RoundSettingsSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { roundId, teeId, playerIndexOverride } = parsed.data;
  return scorecardWrites.changeRoundSettings(session.user.id, roundId, {
    teeId,
    playerIndexOverride: playerIndexOverride === "" ? null : playerIndexOverride,
  });
}

export async function recordRoundScorecardChanges(
  values: RoundScorecardChangesValues,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = RoundScorecardChangesSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { roundId, scores, greenies } = parsed.data;
  return scorecardWrites.recordScorecardChanges(session.user.id, {
    scores: scores.map((score) => ({ roundId, ...score })),
    greenies: greenies.map((greenie) => ({ roundId, ...greenie })),
  });
}

export async function upsertRoundScore(
  values: RoundScoreValues,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = RoundScoreSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  return scorecardWrites.recordScorecardChanges(session.user.id, {
    scores: [parsed.data],
  });
}

export async function upsertRoundGreenie(
  values: RoundGreenieValues,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = RoundGreenieSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { roundId, hole, feet, inches } = parsed.data;
  return scorecardWrites.recordScorecardChanges(session.user.id, {
    greenies: [{ roundId, hole, distance: { feet, inches } }],
  });
}

export async function deleteRoundGreenie(
  values: RoundGreenieDeleteValues,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = RoundGreenieDeleteSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { roundId, hole } = parsed.data;
  return scorecardWrites.recordScorecardChanges(session.user.id, {
    greenies: [{ roundId, hole, distance: null }],
  });
}
