import type { NetScoringRound } from "@/lib/rounds/reads";
import type { MatchSkinHoleResult, MatchSkinsResult } from "@/lib/matches/scoring";
import { displayName, getInitials } from "@/modules/players/player-name";

export type SkinHoleRow = MatchSkinHoleResult;
export type SkinPlayerView = ReturnType<typeof toSkinsView>["players"][number];

/** Add display metadata to the scoring result; game rules live in lib/matches. */
export function toSkinsView(
  result: Extract<MatchSkinsResult, { status: "ready" }>,
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
