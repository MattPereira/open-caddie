import { revalidatePath } from "next/cache";
import { count, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { pairingMembers, pairings, rounds, tournaments } from "@/db/schema";
import { requireAdmin } from "@/lib/players/admin";
import { PAIRING_MAX_MEMBERS } from "./pairings";

// Plain module: only route actions authenticate and parse untrusted input.
// Pairings do not appear in home events, and play pages are force-dynamic, so
// every Pairing write revalidates the Tournament edit page and nothing else.

type PairingWriteResult = { ok: true; id?: number } | { ok: false; error: string };

const NOT_ADMIN = "Only admins can manage Pairings.";

export async function createPairing(
  playerId: string,
  values: { tournamentId: number },
): Promise<PairingWriteResult> {
  const admin = await requireAdmin(playerId, NOT_ADMIN);
  if (!admin.ok) return admin;

  const { tournamentId } = values;
  const [tournament] = await db
    .select({ id: tournaments.id })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!tournament) {
    return { ok: false, error: "Tournament not found." };
  }

  // A new Pairing is named and ordered by the number after the Tournament's
  // highest, read under a lock on the Tournament so two quick creates cannot
  // land on the same number. Deleting the last Pairing frees its number again,
  // which is harmless: the Pairing that held the name is gone.
  const created = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select id from tournaments where id = ${tournamentId} for update`,
    );
    const [highest] = await tx
      .select({ sortOrder: pairings.sortOrder })
      .from(pairings)
      .where(eq(pairings.tournamentId, tournamentId))
      .orderBy(desc(pairings.sortOrder))
      .limit(1);
    const number = (highest?.sortOrder ?? 0) + 1;
    const [pairing] = await tx
      .insert(pairings)
      .values({ tournamentId, name: `Pairing ${number}`, sortOrder: number })
      .returning({ id: pairings.id });
    return pairing;
  });

  revalidatePath(`/tournaments/${tournamentId}/edit`);
  return { ok: true, id: created.id };
}

async function getPairingTournamentId(pairingId: number) {
  const [pairing] = await db
    .select({ tournamentId: pairings.tournamentId })
    .from(pairings)
    .where(eq(pairings.id, pairingId))
    .limit(1);
  return pairing?.tournamentId ?? null;
}

export async function renamePairing(
  playerId: string,
  values: { pairingId: number; name: string },
): Promise<PairingWriteResult> {
  const admin = await requireAdmin(playerId, NOT_ADMIN);
  if (!admin.ok) return admin;

  const { pairingId } = values;
  const name = values.name.trim();
  if (!name) return { ok: false, error: "Name is required" };
  if (name.length > 60) return { ok: false, error: "Name is too long" };
  const tournamentId = await getPairingTournamentId(pairingId);
  if (tournamentId == null) {
    return { ok: false, error: "Pairing not found." };
  }

  await db.update(pairings).set({ name }).where(eq(pairings.id, pairingId));
  revalidatePath(`/tournaments/${tournamentId}/edit`);
  return { ok: true, id: pairingId };
}

export async function deletePairing(
  playerId: string,
  values: { pairingId: number },
): Promise<PairingWriteResult> {
  const admin = await requireAdmin(playerId, NOT_ADMIN);
  if (!admin.ok) return admin;

  const { pairingId } = values;
  const tournamentId = await getPairingTournamentId(pairingId);
  if (tournamentId == null) {
    return { ok: false, error: "Pairing not found." };
  }

  // Membership rows cascade; the Rounds themselves stay in the Tournament.
  await db.delete(pairings).where(eq(pairings.id, pairingId));
  revalidatePath(`/tournaments/${tournamentId}/edit`);
  return { ok: true, id: pairingId };
}

// Moving replaces membership atomically; Rounds and their scores stay intact.
export async function assignRoundToPairing(
  playerId: string,
  values: { pairingId: number; roundId: number },
): Promise<PairingWriteResult> {
  const admin = await requireAdmin(playerId, NOT_ADMIN);
  if (!admin.ok) return admin;

  const { pairingId, roundId } = values;
  const assigned = await db.transaction(async (tx) => {
    const [pairing] = await tx
      .select({ tournamentId: pairings.tournamentId })
      .from(pairings)
      .where(eq(pairings.id, pairingId))
      .limit(1);
    if (!pairing) return { ok: false as const, error: "Pairing not found." };

    // The cap is counted under a lock on the Tournament so two concurrent
    // assignments cannot both read a Pairing of three and each add a fourth.
    await tx.execute(
      sql`select id from tournaments where id = ${pairing.tournamentId} for update`,
    );

    const [round] = await tx
      .select({ tournamentId: rounds.tournamentId })
      .from(rounds)
      .where(eq(rounds.id, roundId))
      .limit(1);
    if (!round) return { ok: false as const, error: "Player's round not found." };
    if (round.tournamentId !== pairing.tournamentId) {
      return {
        ok: false as const,
        error: "That player is not in this Tournament.",
      };
    }

    const [existing] = await tx
      .select({ pairingId: pairingMembers.pairingId })
      .from(pairingMembers)
      .where(eq(pairingMembers.roundId, roundId))
      .limit(1);
    if (existing?.pairingId === pairingId) {
      return { ok: true as const, tournamentId: pairing.tournamentId };
    }

    const [members] = await tx
      .select({ value: count() })
      .from(pairingMembers)
      .where(eq(pairingMembers.pairingId, pairingId));
    if ((members?.value ?? 0) >= PAIRING_MAX_MEMBERS) {
      return {
        ok: false as const,
        error: `A Pairing holds at most ${PAIRING_MAX_MEMBERS} players.`,
      };
    }

    if (existing) {
      await tx.delete(pairingMembers).where(eq(pairingMembers.roundId, roundId));
    }
    await tx.insert(pairingMembers).values({
      tournamentId: pairing.tournamentId,
      pairingId,
      roundId,
    });
    return { ok: true as const, tournamentId: pairing.tournamentId };
  });

  if (!assigned.ok) return assigned;
  revalidatePath(`/tournaments/${assigned.tournamentId}/edit`);
  return { ok: true, id: roundId };
}

// Removing membership leaves the Round in its Tournament, unassigned.
export async function removeRoundFromPairing(
  playerId: string,
  values: { roundId: number },
): Promise<PairingWriteResult> {
  const admin = await requireAdmin(playerId, NOT_ADMIN);
  if (!admin.ok) return admin;

  const { roundId } = values;
  const [member] = await db
    .select({ tournamentId: pairingMembers.tournamentId })
    .from(pairingMembers)
    .where(eq(pairingMembers.roundId, roundId))
    .limit(1);
  if (!member) {
    return { ok: false, error: "That player is not in a Pairing." };
  }

  await db.delete(pairingMembers).where(eq(pairingMembers.roundId, roundId));
  revalidatePath(`/tournaments/${member.tournamentId}/edit`);
  return { ok: true, id: roundId };
}
