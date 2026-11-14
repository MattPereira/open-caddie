"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getSignedInPlayer } from "@/modules/players";
import * as mutations from "@/lib/tournaments/mutations";
import * as pairingWrites from "@/lib/tournaments/pairing-writes";
import {
  roundScorecardImports,
  type UploadRoundScorecardState,
} from "@/modules/rounds/scorecard-import";
import {
  TournamentCreateSchema,
  TournamentUpdateSchema,
  type TournamentCreateValues,
  type TournamentUpdateValues,
} from "./schema";

export type ActionResult = { ok: true; id?: number } | { ok: false; error: string };

export async function createTournament(
  values: TournamentCreateValues,
): Promise<ActionResult> {
  const actor = await getSignedInPlayer();
  if (!actor) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = TournamentCreateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { seasonId, ...rest } = parsed.data;
  return mutations.createTournament(actor.id, {
    ...rest,
    seasonId: seasonId === "" ? null : seasonId,
  });
}

export async function updateTournament(
  values: TournamentUpdateValues,
): Promise<ActionResult> {
  const actor = await getSignedInPlayer();
  if (!actor) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = TournamentUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  return mutations.updateTournament(actor.id, parsed.data);
}

export async function deleteTournament(id: number): Promise<ActionResult> {
  const actor = await getSignedInPlayer();
  if (!actor) {
    return { ok: false, error: "You must be signed in." };
  }

  return mutations.deleteTournament(actor.id, id);
}

const AddPlayersSchema = z.object({
  tournamentId: z.number().int().positive(),
  playerIds: z.array(z.string().min(1)).min(1),
});

export type AddPlayersValues = z.infer<typeof AddPlayersSchema>;

export async function addPlayersToTournament(
  values: AddPlayersValues,
): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  const actor = await getSignedInPlayer();
  if (!actor) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = AddPlayersSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  return mutations.addPlayersToTournament(actor.id, parsed.data);
}

const PairingCreateSchema = z.object({
  tournamentId: z.number().int().positive(),
});

const PairingRenameSchema = z.object({
  pairingId: z.number().int().positive(),
  name: z.string(),
});

const PairingDeleteSchema = z.object({
  pairingId: z.number().int().positive(),
});

const PairingAssignSchema = z.object({
  pairingId: z.number().int().positive(),
  roundId: z.number().int().positive(),
});

const PairingUnassignSchema = z.object({
  roundId: z.number().int().positive(),
});

export type PairingCreateValues = z.infer<typeof PairingCreateSchema>;
export type PairingRenameValues = z.infer<typeof PairingRenameSchema>;
export type PairingDeleteValues = z.infer<typeof PairingDeleteSchema>;
export type PairingAssignValues = z.infer<typeof PairingAssignSchema>;
export type PairingUnassignValues = z.infer<typeof PairingUnassignSchema>;

export async function createPairing(
  values: PairingCreateValues,
): Promise<ActionResult> {
  const actor = await getSignedInPlayer();
  if (!actor) {
    return { ok: false, error: "Only admins can manage Pairings." };
  }

  const parsed = PairingCreateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  return pairingWrites.createPairing(actor.id, parsed.data);
}

export async function renamePairing(
  values: PairingRenameValues,
): Promise<ActionResult> {
  const actor = await getSignedInPlayer();
  if (!actor) {
    return { ok: false, error: "Only admins can manage Pairings." };
  }

  const parsed = PairingRenameSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  return pairingWrites.renamePairing(actor.id, parsed.data);
}

export async function deletePairing(
  values: PairingDeleteValues,
): Promise<ActionResult> {
  const actor = await getSignedInPlayer();
  if (!actor) {
    return { ok: false, error: "Only admins can manage Pairings." };
  }

  const parsed = PairingDeleteSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  return pairingWrites.deletePairing(actor.id, parsed.data);
}

export async function assignRoundToPairing(
  values: PairingAssignValues,
): Promise<ActionResult> {
  const actor = await getSignedInPlayer();
  if (!actor) {
    return { ok: false, error: "Only admins can manage Pairings." };
  }

  const parsed = PairingAssignSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  return pairingWrites.assignRoundToPairing(actor.id, parsed.data);
}

export async function removeRoundFromPairing(
  values: PairingUnassignValues,
): Promise<ActionResult> {
  const actor = await getSignedInPlayer();
  if (!actor) {
    return { ok: false, error: "Only admins can manage Pairings." };
  }

  const parsed = PairingUnassignSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  return pairingWrites.removeRoundFromPairing(actor.id, parsed.data);
}

export async function uploadTournamentRoundScorecard(
  tournamentId: number,
  _state: UploadRoundScorecardState,
  formData: FormData,
): Promise<UploadRoundScorecardState> {
  const actor = await getSignedInPlayer();
  if (!actor) return { error: "You must be signed in." };

  const result = await roundScorecardImports.importRoundScorecard({
    playerId: actor.id,
    eventKind: "tournament",
    eventId: tournamentId,
    formData,
  });
  if (!result.ok) return { error: result.error };
  redirect(result.redirectPath);
}
