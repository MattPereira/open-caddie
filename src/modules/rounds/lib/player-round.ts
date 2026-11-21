type PlayerRound = { playerId: string };

/** The Round a Player played among an event's Rounds; a visitor has none. */
export function findPlayerRound<Round extends PlayerRound>(
  rounds: readonly Round[],
  playerId: string | null | undefined,
): Round | null {
  return rounds.find((round) => round.playerId === playerId) ?? null;
}
