import type { PointRules } from "@/modules/clubs";
import { addClubMember, createClub } from "@/modules/clubs/server";

import { strugglingCard } from "./cards";
import type { SeededCourses } from "./courses";
import { dateFromToday, seedTournament, type TournamentPlan } from "./events";
import { ok } from "./ok";
import type { PlayerIds, PlayerKey } from "./players";

const POINT_RULES: PointRules = {
  participation: 2,
  pars: 1,
  birdies: 3,
  eagles: 6,
  aces: 10,
  strokes: { positions: [10, 7, 5, 3, 1] },
  putts: { positions: [5, 3, 1] },
  greenies: {
    tiers: [
      { maxFt: 3, pts: 5 },
      { maxFt: 10, pts: 3 },
      { maxFt: null, pts: 1 },
    ],
  },
};

const SATURDAY_CLUB = "saturday-club";
const DAWN_PATROL = "dawn-patrol";

const SATURDAY_MEMBERS: PlayerKey[] = [
  "ava",
  "marcus",
  "priya",
  "tomas",
  "hannah",
  "dev",
  "noor",
  "felix",
  "grace",
  "kenji",
  "wilhelmina",
  "rosa",
  "maya",
  "ike",
];
const DAWN_PATROL_MEMBERS: PlayerKey[] = [
  "kenji",
  "noor",
  "priya",
  "maya",
  "bram",
  "jules",
  "zoe",
  "siobhan",
  "leo",
];

async function seedClub(
  adminId: string,
  ids: PlayerIds,
  club: { handle: string; name: string; members: PlayerKey[] },
) {
  const { id: clubId } = ok(
    await createClub(adminId, {
      handle: club.handle,
      name: club.name,
      logo: "",
      pointRules: POINT_RULES,
    }),
    `club ${club.handle}`,
  );
  for (const key of club.members) {
    ok(
      await addClubMember(adminId, { clubId, playerId: ids[key] }),
      `${club.handle} member ${key}`,
    );
  }
}

export async function seedSaturdayClub(
  adminId: string,
  ids: PlayerIds,
  courses: SeededCourses,
) {
  const { gullwing, saguaro, oakmere, portHaven, brackenmoor } = courses;
  await seedClub(adminId, ids, {
    handle: SATURDAY_CLUB,
    name: "Saturday Club",
    members: SATURDAY_MEMBERS,
  });
  const seed = (plan: TournamentPlan) =>
    seedTournament(adminId, ids, SATURDAY_CLUB, plan);

  // Season 1, now a Past Season.
  await seed({
    date: dateFromToday(-150),
    course: oakmere,
    tee: "White",
    pairings: [
      ["ava", "marcus", "priya", "tomas"],
      ["hannah", "dev", "noor", "felix"],
    ],
    holesScored: 18,
    salt: 1,
    greenies: [
      {
        player: "ava",
        hole: oakmere.parThrees[0],
        distance: { feet: 4, inches: 2 },
      },
      {
        player: "felix",
        hole: oakmere.parThrees[2],
        distance: { feet: 18, inches: 6 },
      },
    ],
  });
  await seed({
    date: dateFromToday(-136),
    course: gullwing,
    tee: "Blue",
    pairings: [
      ["ava", "marcus", "priya"],
      ["tomas", "grace", "kenji"],
      ["wilhelmina", "rosa", "felix"],
    ],
    holesScored: 18,
    salt: 2,
    greenies: [
      {
        player: "kenji",
        hole: gullwing.parThrees[1],
        distance: { feet: 1, inches: 11 },
      },
      {
        player: "wilhelmina",
        hole: gullwing.parThrees[3],
        distance: { feet: 7, inches: 0 },
      },
    ],
  });
  await seed({
    date: dateFromToday(-122),
    course: saguaro,
    tee: "White",
    pairings: [
      ["ava", "priya", "tomas", "hannah"],
      ["dev", "noor", "felix", "grace"],
    ],
    holesScored: 18,
    salt: 3,
  });

  // Season 2, the Current Season.
  await seed({
    date: dateFromToday(-56),
    course: portHaven,
    tee: "Blue",
    startNextSeason: true,
    pairings: [
      ["ava", "marcus", "priya", "tomas"],
      ["hannah", "dev", "noor"],
      ["felix", "grace", "kenji"],
    ],
    holesScored: 18,
    salt: 4,
    greenies: [
      {
        player: "marcus",
        hole: portHaven.parThrees[0],
        distance: { feet: 3, inches: 0 },
      },
      {
        player: "grace",
        hole: portHaven.parThrees[2],
        distance: { feet: 22, inches: 4 },
      },
    ],
  });
  // Salt 34 has Noor win four Tournament Skins and leaves six holes dead.
  // The Playing Handicaps come from the Rounds before, so changing those can
  // undo it; the seed test checks.
  await seed({
    date: dateFromToday(-42),
    course: brackenmoor,
    tee: "Gold",
    pairings: [
      ["ava", "marcus", "priya"],
      ["tomas", "hannah", "noor"],
      ["felix", "wilhelmina", "rosa"],
    ],
    holesScored: 18,
    salt: 34,
  });
  await seed({
    date: dateFromToday(-28),
    course: oakmere,
    tee: "Blue",
    pairings: [
      ["ava", "marcus", "tomas", "hannah"],
      ["dev", "noor", "felix", "grace"],
      ["kenji", "wilhelmina", "maya"],
    ],
    holesScored: 18,
    salt: 6,
    greenies: [
      {
        player: "hannah",
        hole: oakmere.parThrees[1],
        distance: { feet: 9, inches: 5 },
      },
    ],
  });
  await seed({
    date: dateFromToday(-14),
    course: gullwing,
    tee: "White",
    pairings: [
      ["ava", "priya", "tomas"],
      ["marcus", "noor", "felix"],
      ["grace", "kenji", "rosa"],
    ],
    holesScored: 18,
    salt: 7,
    holes: [
      {
        player: "noor",
        hole: gullwing.parThrees[2],
        score: { strokes: 1, putts: 0 },
      },
    ],
    greenies: [
      {
        player: "noor",
        hole: gullwing.parThrees[2],
        distance: { feet: 0, inches: 0 },
      },
      {
        player: "rosa",
        hole: gullwing.parThrees[0],
        distance: { feet: 12, inches: 0 },
      },
    ],
  });
  // Maya's one prior Saturday Round is too few for a Player Index, so she
  // plays off scratch.
  await seed({
    date: dateFromToday(0),
    course: saguaro,
    tee: "Blue",
    pairings: [
      ["ava", "marcus", "priya", "tomas"],
      ["hannah", "maya"],
    ],
    holesScored: 9,
    salt: 8,
  });
  await seed({
    date: dateFromToday(7),
    course: portHaven,
    tee: "White",
    pairings: [
      ["ava", "marcus", "dev"],
      ["noor", "grace"],
    ],
    holesScored: 0,
    salt: 9,
  });
}

export async function seedDawnPatrol(
  adminId: string,
  ids: PlayerIds,
  courses: SeededCourses,
) {
  const { gullwing, brackenmoor, fernHollow } = courses;
  await seedClub(adminId, ids, {
    handle: DAWN_PATROL,
    name: "Dawn Patrol Golf Society",
    members: DAWN_PATROL_MEMBERS,
  });
  const seed = (plan: TournamentPlan) =>
    seedTournament(adminId, ids, DAWN_PATROL, plan);

  // Siobhán and Leo play only this one, with the same card, below every
  // paying Tournament Ranking position: they tie in Standings.
  const struggling = strugglingCard(fernHollow.pars);
  await seed({
    date: dateFromToday(-70),
    course: fernHollow,
    tee: "Green",
    pairings: [
      ["kenji", "noor", "priya", "bram"],
      ["maya", "zoe", "siobhan", "leo"],
    ],
    holesScored: 18,
    salt: 11,
    cards: { siobhan: struggling, leo: struggling },
  });
  await seed({
    date: dateFromToday(-35),
    course: brackenmoor,
    tee: "Black",
    pairings: [
      ["kenji", "noor", "priya"],
      ["bram", "maya", "zoe", "jules"],
    ],
    holesScored: 18,
    salt: 12,
    greenies: [
      {
        player: "zoe",
        hole: brackenmoor.parThrees[0],
        distance: { feet: 5, inches: 8 },
      },
      {
        player: "jules",
        hole: brackenmoor.parThrees[3],
        distance: { feet: 2, inches: 1 },
      },
    ],
  });
  await seed({
    date: dateFromToday(-21),
    course: gullwing,
    tee: "Blue",
    pairings: [
      ["kenji", "bram", "jules", "zoe"],
      ["noor", "maya", "priya"],
    ],
    holesScored: 18,
    salt: 13,
  });
  await seed({
    date: dateFromToday(14),
    course: fernHollow,
    tee: "Green",
    pairings: [["kenji", "noor", "bram"]],
    holesScored: 0,
    salt: 14,
  });
}
