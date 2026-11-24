import { required } from "@/lib/required";
import { createPlayer } from "@/modules/players/server";

import { ok } from "./ok";

type PlayerPlan = {
  firstName: string;
  lastName: string;
  skill: number;
  /** Defaults to `<key>@example.com`. */
  email?: string;
};

export const PLAYERS = {
  ava: { firstName: "Ava", lastName: "Lindqvist", skill: -2 },
  marcus: { firstName: "Marcus", lastName: "Okafor", skill: -1 },
  kenji: { firstName: "Kenji", lastName: "Watanabe", skill: -1 },
  priya: { firstName: "Priya", lastName: "Raman", skill: 0 },
  noor: { firstName: "Noor", lastName: "Haddad", skill: 0 },
  bram: { firstName: "Bram", lastName: "Vandersteen", skill: 0 },
  jules: { firstName: "Jules", lastName: "Fontaine", skill: 0 },
  tomas: { firstName: "Tomás", lastName: "Ibarra", skill: 1 },
  hannah: { firstName: "Hannah", lastName: "Brightwater", skill: 1 },
  felix: { firstName: "Felix", lastName: "Moreau", skill: 1 },
  maya: { firstName: "Maya", lastName: "Thornbury", skill: 1 },
  zoe: { firstName: "Zoë", lastName: "Kristiansen", skill: 1 },
  // createPlayer stores "" for no email, and the column is unique, so only
  // one Player can go without.
  rosa: { firstName: "Rosa", lastName: "Delgado", skill: 1, email: "" },
  dev: { firstName: "Devon", lastName: "Achterberg", skill: 2 },
  grace: { firstName: "Grace", lastName: "Whitfield", skill: 2 },
  siobhan: { firstName: "Siobhán", lastName: "Ó Ceallaigh", skill: 2 },
  // Long enough to wrap or truncate in tables and cards.
  wilhelmina: {
    firstName: "Wilhelmina",
    lastName: "Featherstonehaugh-Montgomery",
    skill: 2,
  },
  leo: { firstName: "Leo", lastName: "Castellanos", skill: 3 },
  // A Club Member with no last name and no Rounds.
  ike: { firstName: "Ike", lastName: "", skill: 3 },
} satisfies Record<string, PlayerPlan>;
export type PlayerKey = keyof typeof PLAYERS;
export type PlayerIds = Record<PlayerKey, string>;

/** Looks up each Player's Round among an Event's Rounds. */
export function roundsByPlayer(
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
        image: "",
        isAdmin: false,
      }),
      `player ${key}`,
    );
    ids[key] = created.id;
  }
  return ids;
}
