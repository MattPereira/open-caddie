/** The Round a Player played among an event's Rounds, or null when they didn't play. */
export function findPlayerRound<TRound extends { playerId: string }>(
  rounds: readonly TRound[],
  playerId: string | null | undefined,
): TRound | null {
  if (!playerId) return null;
  return rounds.find((round) => round.playerId === playerId) ?? null;
}
