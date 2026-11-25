import { required } from "@/lib/required";
import { createPlayer } from "@/modules/players/server";

import { ok } from "./ok";
import { PLAYER_IMAGES } from "./image-data";

type PlayerPlan = {
  firstName: string;
  lastName: string;
  skill: number;
  /** Defaults to `<key>@example.com`. */
  email?: string;
};

export const PLAYERS = {
  panther: { firstName: "Panther", lastName: "Woods", skill: -2 },
  john: { firstName: "John", lastName: "Nightly", skill: -1 },
  scottie: { firstName: "Scottie", lastName: "Shuffler", skill: -1 },
  rory: { firstName: "Rory", lastName: "McEagle", skill: 0 },
  phil: { firstName: "Phil", lastName: "Nickelson", skill: 0 },
  tyson: { firstName: "Tyson", lastName: "DeShambles", skill: 0 },
  rivers: { firstName: "Rivers", lastName: "Koepka", skill: 0 },
  dustin: { firstName: "Dustin", lastName: "Thomas", skill: 1 },
  justin: { firstName: "Justin", lastName: "Johnson", skill: 1 },
  jordan: { firstName: "Jordan", lastName: "Slice", skill: 1 },
  rickie: { firstName: "Rickie", lastName: "Fowleri", skill: 1 },
  bubba: { firstName: "Bubba", lastName: "Wattson", skill: 1 },
  // createPlayer stores "" for no email, and the column is unique, so only
  // one Player can go without.
  arnold: { firstName: "Arnold", lastName: "Lemonade", skill: 1, email: "" },
  jack: { firstName: "Jack", lastName: "Nickel", skill: 2 },
  jon: { firstName: "Jon", lastName: "Ram", skill: 2 },
  vijay: { firstName: "Vijay", lastName: "Swing", skill: 2 },
  collin: {
    firstName: "Collin",
    lastName: "Mulligan",
    skill: 2,
  },
  max: { firstName: "Max", lastName: "Bogey", skill: 3 },
  // A Club Member with no Rounds.
  adam: { firstName: "Adam", lastName: "Scotty", skill: 3 },
} satisfies Record<string, PlayerPlan>;
export type PlayerKey = keyof typeof PLAYERS;
export type PlayerIds = Record<PlayerKey, string>;

export function roundIdOf(
  rounds: { id: number; playerId: string }[],
  ids: PlayerIds,
) {
  return (key: PlayerKey) =>
    required(
      rounds.find((round) => round.playerId === ids[key]),
      `${key}'s round`,
    ).id;
}

export async function seedPlayers(adminId: string): Promise<PlayerIds> {
  const ids = {} as PlayerIds;
  for (const [key, player] of Object.entries(PLAYERS) as [
    PlayerKey,
    PlayerPlan,
  ][]) {
    const created = ok(
      await createPlayer(adminId, {
        email: player.email ?? `${key}@example.com`,
        firstName: player.firstName,
        lastName: player.lastName,
        username: "",
        image: PLAYER_IMAGES[key],
        isAdmin: false,
      }),
      `player ${key}`,
    );
    ids[key] = created.id;
  }
  return ids;
}
