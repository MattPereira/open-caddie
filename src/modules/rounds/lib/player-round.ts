export function findPlayerRound<Round extends { playerId: string }>(
  rounds: readonly Round[],
  playerId: string | null | undefined,
): Round | null {
  return rounds.find((round) => round.playerId === playerId) ?? null;
}
