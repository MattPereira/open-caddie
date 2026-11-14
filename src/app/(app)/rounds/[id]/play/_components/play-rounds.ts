import type { RoundEvent } from "@/modules/rounds";

/** The page of the played Round's event, or null for a casual Round. */
export function eventPage(round: RoundEvent) {
  if (round.kind === "tournament") {
    return { href: `/tournaments/${round.tournamentId}`, label: "Tournament" };
  }
  if (round.kind === "match") {
    return { href: `/matches/${round.matchId}`, label: "Match" };
  }
  return null;
}

/**
 * The played Round and the Scorer's other columns, picked out of the event's
 * Rounds. Columns keep the order of `scorableRoundIds`, not the event's
 * ranking order. Null when the played Round isn't in the event.
 */
export function pickPlayRounds<R extends { id: number }>(
  eventRounds: readonly R[],
  roundId: number,
  scorableRoundIds: readonly number[],
) {
  const byId = new Map(eventRounds.map((round) => [round.id, round]));
  const round = byId.get(roundId);
  if (!round) return null;
  return {
    round,
    scorableRounds: scorableRoundIds.flatMap((id) => byId.get(id) ?? []),
  };
}
