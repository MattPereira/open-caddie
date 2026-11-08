import type { NetScoringRound } from "@/lib/rounds/reads";
import type { SkinHoleResult, SkinsScoringResult } from "@/lib/matches/scoring";
import { displayName, getInitials } from "@/lib/players/player-name";

export type SkinHoleRow = SkinHoleResult;
export type SkinPlayerView = ReturnType<typeof toSkinsView>["players"][number];

/** Add display metadata to the scoring result; game rules live in lib/matches. */
export function toSkinsView(
  result: Extract<SkinsScoringResult, { status: "ready" }>,
  rounds: NetScoringRound[],
) {
  const roundsById = new Map(rounds.map((round) => [round.id, round]));
  return {
    holes: result.holes,
    players: result.players.map((player) => {
      const round = roundsById.get(player.id)!;
      return {
        ...player,
        name: displayName({ ...round, email: null }),
        initials: getInitials({ ...round, email: null }),
        image: round.image,
      };
    }),
  };
}
