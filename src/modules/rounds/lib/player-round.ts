export function findPlayerRound<TRound extends { playerId: string }>(
  rounds: readonly TRound[],
  playerId: string | null | undefined,
): TRound | null {
  if (!playerId) return null;
  return rounds.find((round) => round.playerId === playerId) ?? null;
}
