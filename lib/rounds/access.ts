import { and, asc, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { matches, pairingMembers, rounds, users } from "@/db/schema";

export type AccessedRound = {
  id: number;
  userId: string;
  courseId: number;
  tournamentId: number | null;
  matchId: number | null;
};

export type RoundAccess = {
  round: AccessedRound;
  /** May enter the Round's per-hole scores and Greenies (a Scorer). */
  canScore: boolean;
  /** May change the Round itself: its tee, override, or delete it. */
  canManage: boolean;
  /** Other Rounds in the same Pairing or Match the viewer may score. */
  scorablePeerRoundIds: number[];
};

/**
 * The single answer to "may this viewer score or manage this Round". Encodes
 * the Scorer rule from CONTEXT.md. Returns null when the Round doesn't exist.
 */
export async function getRoundAccess(
  viewerUserId: string,
  roundId: number,
): Promise<RoundAccess | null> {
  const [round] = await db
    .select({
      id: rounds.id,
      userId: rounds.userId,
      courseId: rounds.courseId,
      tournamentId: rounds.tournamentId,
      matchId: rounds.matchId,
    })
    .from(rounds)
    .where(eq(rounds.id, roundId))
    .limit(1);
  if (!round) return null;

  const [[viewer], groupMates, matchCreatorId] = await Promise.all([
    db
      .select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, viewerUserId))
      .limit(1),
    readGroupMates(round),
    readMatchCreatorId(round.matchId),
  ]);

  const canManage = round.userId === viewerUserId || viewer?.isAdmin === true;
  const canScore =
    canManage ||
    matchCreatorId === viewerUserId ||
    groupMates.some((mate) => mate.userId === viewerUserId);

  // Everyone in a Pairing or Match scores the whole group alike, so a Scorer
  // of this Round is a Scorer of each of its group mates.
  return {
    round,
    canScore,
    canManage,
    scorablePeerRoundIds: canScore ? groupMates.map((mate) => mate.roundId) : [],
  };
}

// A Tournament grants nothing on its own: only a shared Pairing does, so a
// Round in no Pairing has no group mates.
async function readGroupMates(
  round: AccessedRound,
): Promise<{ roundId: number; userId: string }[]> {
  const nameOrder = [
    asc(users.lastName),
    asc(users.firstName),
    asc(users.username),
    asc(rounds.id),
  ];

  if (round.matchId != null) {
    return db
      .select({ roundId: rounds.id, userId: rounds.userId })
      .from(rounds)
      .innerJoin(users, eq(users.id, rounds.userId))
      .where(and(eq(rounds.matchId, round.matchId), ne(rounds.id, round.id)))
      .orderBy(...nameOrder);
  }

  if (round.tournamentId == null) return [];

  const [membership] = await db
    .select({ pairingId: pairingMembers.pairingId })
    .from(pairingMembers)
    .where(eq(pairingMembers.roundId, round.id))
    .limit(1);
  if (!membership) return [];

  return db
    .select({ roundId: rounds.id, userId: rounds.userId })
    .from(pairingMembers)
    .innerJoin(rounds, eq(rounds.id, pairingMembers.roundId))
    .innerJoin(users, eq(users.id, rounds.userId))
    .where(
      and(
        eq(pairingMembers.pairingId, membership.pairingId),
        ne(pairingMembers.roundId, round.id),
      ),
    )
    .orderBy(...nameOrder);
}

async function readMatchCreatorId(matchId: number | null) {
  if (matchId == null) return null;
  const [match] = await db
    .select({ createdByUserId: matches.createdByUserId })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);
  return match?.createdByUserId ?? null;
}
