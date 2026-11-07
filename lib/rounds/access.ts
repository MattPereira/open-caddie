import { cache } from "react";
import { and, asc, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { matches, pairingMembers, rounds, users } from "@/db/schema";
import { EVENT_KINDS, type EventKind } from "./events";

const accessedRoundColumns = {
  id: rounds.id,
  userId: rounds.userId,
  courseId: rounds.courseId,
  tournamentId: rounds.tournamentId,
  matchId: rounds.matchId,
};

export type AccessedRound = {
  id: number;
  userId: string;
  courseId: number;
  tournamentId: number | null;
  matchId: number | null;
};

type Viewer = { id: string; isAdmin: boolean };

export type RoundManageFailure =
  | { ok: false; reason: "not_found"; error: string }
  | { ok: false; reason: "cannot_manage"; error: string };

export const ROUND_NOT_FOUND = {
  ok: false,
  reason: "not_found",
  error: "Round not found.",
} as const;
export const CANNOT_MANAGE_ROUND = {
  ok: false,
  reason: "cannot_manage",
  error: "You can't change this Round's settings.",
} as const;

export type RoundAccess = {
  round: AccessedRound;
  /** May enter the Round's per-hole scores and Greenies (a Scorer). */
  canScore: boolean;
  /** May change the Round itself: its tee, override, or delete it. */
  canManage: boolean;
  /** Other Rounds in the same Pairing or Match the viewer may score. */
  otherScorableRoundIds: number[];
};

/**
 * The Scorer and manage rules from CONTEXT.md, for one Round. `sameGroup` is
 * the Rounds of its Pairing mates, or of its Match's other players.
 */
function decideAccess(
  viewer: Viewer,
  round: AccessedRound,
  sameGroup: { userId: string }[],
  matchCreatorId: string | null,
) {
  const canManage = round.userId === viewer.id || viewer.isAdmin;
  const canScore =
    canManage ||
    matchCreatorId === viewer.id ||
    sameGroup.some((other) => other.userId === viewer.id);
  return { canScore, canManage };
}

/**
 * The single answer to "may this viewer score or manage this Round". Returns
 * null when the Round doesn't exist. Writes call this directly; pages use the
 * cache()-wrapped getRoundAccess.
 */
export async function readRoundAccess(
  viewerUserId: string,
  roundId: number,
): Promise<RoundAccess | null> {
  const [round] = await db
    .select(accessedRoundColumns)
    .from(rounds)
    .where(eq(rounds.id, roundId))
    .limit(1);
  if (!round) return null;

  const [viewer, sameGroup, matchCreatorId] = await Promise.all([
    readViewer(viewerUserId),
    readPairingOrMatchRounds(round),
    readMatchCreatorId(round.matchId),
  ]);
  const { canScore, canManage } = decideAccess(
    viewer,
    round,
    sameGroup,
    matchCreatorId,
  );

  // Everyone in a Pairing or Match scores the whole group alike, so a Scorer
  // of this Round is a Scorer of every other Round in it.
  return {
    round,
    canScore,
    canManage,
    otherScorableRoundIds: canScore
      ? sameGroup.map((other) => other.roundId)
      : [],
  };
}

export const getRoundAccess = cache(readRoundAccess);

export type EventRoundAccess = {
  scorableRoundIds: number[];
  manageableRoundIds: number[];
  /**
   * May use the Round Scorecard Import: a Scorer of some Round besides their
   * own, since a card is a group's. A Tournament player in no Pairing scores
   * only their own Round, so they can't.
   */
  canImportScorecard: boolean;
};

/**
 * The Scorer rule across a whole Tournament or Match, for pages that list its
 * Rounds. Agrees with getRoundAccess Round by Round, without reading each one.
 */
export const getEventRoundAccess = cache(
  async (
    viewerUserId: string,
    eventKind: EventKind,
    eventId: number,
  ): Promise<EventRoundAccess> => {
    const [eventRounds, viewer, { groupOf, matchCreatorId }] =
      await Promise.all([
        db
          .select(accessedRoundColumns)
          .from(rounds)
          .where(EVENT_KINDS[eventKind].roundsOf(eventId)),
        readViewer(viewerUserId),
        readEventScoringGroups[eventKind](eventId),
      ]);

    const scorableRoundIds: number[] = [];
    const manageableRoundIds: number[] = [];
    for (const round of eventRounds) {
      const group = groupOf(round.id);
      const sameGroup =
        group == null
          ? []
          : eventRounds.filter(
              (other) => other.id !== round.id && groupOf(other.id) === group,
            );
      const { canScore, canManage } = decideAccess(
        viewer,
        round,
        sameGroup,
        matchCreatorId,
      );
      if (canScore) scorableRoundIds.push(round.id);
      if (canManage) manageableRoundIds.push(round.id);
    }

    const ownRoundId = eventRounds.find(
      (round) => round.userId === viewerUserId,
    )?.id;
    return {
      scorableRoundIds,
      manageableRoundIds,
      canImportScorecard: scorableRoundIds.some((id) => id !== ownRoundId),
    };
  },
);

async function readViewer(userId: string): Promise<Viewer> {
  const [user] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return { id: userId, isAdmin: user?.isAdmin === true };
}

type EventScoringGroups = {
  /** The Round's Pairing, or its Match; undefined when in neither. */
  groupOf: (roundId: number) => number | undefined;
  matchCreatorId: string | null;
};

// A Tournament grants nothing on its own: only a shared Pairing does, so a
// Round in no Pairing is in no group.
const readEventScoringGroups: Record<
  EventKind,
  (eventId: number) => Promise<EventScoringGroups>
> = {
  tournament: async (tournamentId) => {
    const members = await db
      .select({
        roundId: pairingMembers.roundId,
        pairingId: pairingMembers.pairingId,
      })
      .from(pairingMembers)
      .where(eq(pairingMembers.tournamentId, tournamentId));
    const pairingIdByRound = new Map(
      members.map((member) => [member.roundId, member.pairingId]),
    );
    return {
      groupOf: (roundId) => pairingIdByRound.get(roundId),
      matchCreatorId: null,
    };
  },
  match: async (matchId) => ({
    groupOf: () => matchId,
    matchCreatorId: await readMatchCreatorId(matchId),
  }),
};

// As in readEventScoringGroups, a Round in no Pairing has no other Rounds.
async function readPairingOrMatchRounds(
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
