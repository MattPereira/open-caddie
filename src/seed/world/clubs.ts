import type { PointRules } from "@/modules/clubs";
import { addClubMember, createClub } from "@/modules/clubs/server";

import { strugglingCard } from "./cards";
import type { SeededCourses } from "./courses";
import { dateFromToday, seedTournament, type TournamentPlan } from "./events";
import { ok } from "./ok";
import { CLUB_IMAGES } from "./image-data";
import type { PlayerIds, PlayerKey } from "./players";
import type { SeededRoute } from "./routes";

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

const MULLIGAN_MAFIA = { handle: "mulligan-mafia", name: "Mulligan Mafia" };
const HANDICAP_HUSTLERS = {
  handle: "handicap-hustlers",
  name: "Handicap Hustlers",
};

const MULLIGAN_MEMBERS: PlayerKey[] = [
  "panther",
  "john",
  "rory",
  "dustin",
  "justin",
  "jack",
  "phil",
  "jordan",
  "jon",
  "scottie",
  "collin",
  "arnold",
  "rickie",
  "adam",
];
const HANDICAP_HUSTLERS_MEMBERS: PlayerKey[] = [
  "scottie",
  "phil",
  "rory",
  "rickie",
  "tyson",
  "rivers",
  "bubba",
  "vijay",
  "max",
];

async function seedClub(
  adminId: string,
  ids: PlayerIds,
  club: { handle: string; name: string; members: PlayerKey[] },
  standings: string,
): Promise<SeededRoute[]> {
  const { id: clubId } = ok(
    await createClub(adminId, {
      handle: club.handle,
      name: club.name,
      logo: CLUB_IMAGES[club.handle],
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
  return [
    {
      path: `/clubs/${club.handle}`,
      shows: `${club.name}: ${club.members.length} Members, ${standings}`,
    },
  ];
}

export async function seedMulliganMafia(
  adminId: string,
  ids: PlayerIds,
  courses: SeededCourses,
): Promise<SeededRoute[]> {
  const { pebbleBeach, sawgrass, kapalua, maunaKea, bethpage } = courses;
  const routes = await seedClub(
    adminId,
    ids,
    { ...MULLIGAN_MAFIA, members: MULLIGAN_MEMBERS },
    "Current Season 2 Standings",
  );
  routes.push({
    path: `/clubs/${MULLIGAN_MAFIA.handle}?season=1`,
    shows: `${MULLIGAN_MAFIA.name}: Past Season 1 Standings`,
  });
  const seed = async (plan: TournamentPlan) => {
    routes.push(...(await seedTournament(adminId, ids, MULLIGAN_MAFIA, plan)));
  };

  // Season 1, now a Past Season.
  await seed({
    date: dateFromToday(-150),
    course: kapalua,
    tee: "Resort",
    pairings: [
      ["panther", "john", "rory", "dustin"],
      ["justin", "jack", "phil", "jordan"],
    ],
    holesScored: 18,
    salt: 1,
    greenies: [
      {
        player: "panther",
        hole: kapalua.parThrees[0],
        distance: { feet: 4, inches: 2 },
      },
      {
        player: "jordan",
        hole: kapalua.parThrees[2],
        distance: { feet: 18, inches: 6 },
      },
    ],
  });
  await seed({
    date: dateFromToday(-136),
    course: pebbleBeach,
    tee: "Blue",
    pairings: [
      ["panther", "john", "rory"],
      ["dustin", "jon", "scottie"],
      ["collin", "arnold", "jordan"],
    ],
    holesScored: 18,
    salt: 2,
    greenies: [
      {
        player: "scottie",
        hole: pebbleBeach.parThrees[1],
        distance: { feet: 1, inches: 11 },
      },
      {
        player: "collin",
        hole: pebbleBeach.parThrees[3],
        distance: { feet: 7, inches: 0 },
      },
    ],
  });
  await seed({
    date: dateFromToday(-122),
    course: sawgrass,
    tee: "White",
    pairings: [
      ["panther", "rory", "dustin", "justin"],
      ["jack", "phil", "jordan", "jon"],
    ],
    holesScored: 18,
    salt: 3,
  });

  // Season 2, the Current Season.
  await seed({
    date: dateFromToday(-56),
    course: maunaKea,
    tee: "Tournament",
    startNextSeason: true,
    note: "Starts Season 2",
    pairings: [
      ["panther", "john", "rory", "dustin"],
      ["justin", "jack", "phil"],
      ["jordan", "jon", "scottie"],
    ],
    holesScored: 18,
    salt: 4,
    greenies: [
      {
        player: "john",
        hole: maunaKea.parThrees[0],
        distance: { feet: 3, inches: 0 },
      },
      {
        player: "jon",
        hole: maunaKea.parThrees[2],
        distance: { feet: 22, inches: 4 },
      },
    ],
  });
  // Salt 100 has Phil win four Tournament Skins and leaves six holes dead.
  // The Playing Handicaps come from the Rounds before, so changing those can
  // undo it; the seed test checks.
  await seed({
    date: dateFromToday(-42),
    course: bethpage,
    tee: "White",
    pairings: [
      ["panther", "john", "rory"],
      ["dustin", "justin", "phil"],
      ["jordan", "collin", "arnold"],
    ],
    holesScored: 18,
    salt: 100,
    note: "Tournament Skins: Phil wins four, six holes dead",
  });
  await seed({
    date: dateFromToday(-28),
    course: kapalua,
    tee: "Regular",
    pairings: [
      ["panther", "john", "dustin", "justin"],
      ["jack", "phil", "jordan", "jon"],
      ["scottie", "collin", "rickie"],
    ],
    holesScored: 18,
    salt: 6,
    greenies: [
      {
        player: "justin",
        hole: kapalua.parThrees[1],
        distance: { feet: 9, inches: 5 },
      },
    ],
  });
  await seed({
    date: dateFromToday(-14),
    course: pebbleBeach,
    tee: "White",
    pairings: [
      ["panther", "rory", "dustin"],
      ["john", "phil", "jordan"],
      ["jon", "scottie", "arnold"],
    ],
    holesScored: 18,
    salt: 7,
    note: "Phil's hole-in-one, a 0-ft Greenie",
    holes: [
      {
        player: "phil",
        hole: pebbleBeach.parThrees[2],
        score: { strokes: 1, putts: 0 },
      },
    ],
    greenies: [
      {
        player: "phil",
        hole: pebbleBeach.parThrees[2],
        distance: { feet: 0, inches: 0 },
      },
      {
        player: "arnold",
        hole: pebbleBeach.parThrees[0],
        distance: { feet: 12, inches: 0 },
      },
    ],
  });
  // Rickie's one prior Mafia Round is too few for a Player Index, so he
  // plays off scratch.
  await seed({
    date: dateFromToday(0),
    course: sawgrass,
    tee: "Blue",
    pairings: [
      ["panther", "john", "rory", "dustin"],
      ["justin", "rickie"],
    ],
    holesScored: 9,
    salt: 8,
    note: "Rickie plays off scratch",
  });
  await seed({
    date: dateFromToday(7),
    course: maunaKea,
    tee: "Resort",
    pairings: [
      ["panther", "john", "jack"],
      ["phil", "jon"],
    ],
    holesScored: 0,
    salt: 9,
  });
  return routes;
}

export async function seedHandicapHustlers(
  adminId: string,
  ids: PlayerIds,
  courses: SeededCourses,
): Promise<SeededRoute[]> {
  const { pebbleBeach, bethpage, royalCountyDown } = courses;
  const routes = await seedClub(
    adminId,
    ids,
    { ...HANDICAP_HUSTLERS, members: HANDICAP_HUSTLERS_MEMBERS },
    "one Season, Vijay and Max tied in Standings",
  );
  const seed = async (plan: TournamentPlan) => {
    routes.push(
      ...(await seedTournament(adminId, ids, HANDICAP_HUSTLERS, plan)),
    );
  };

  // Vijay and Max play only this one, with the same card, below every
  // paying Tournament Ranking position: they tie in Standings.
  const struggling = strugglingCard(royalCountyDown.pars);
  await seed({
    date: dateFromToday(-70),
    course: royalCountyDown,
    tee: "White",
    pairings: [
      ["scottie", "phil", "rory", "tyson"],
      ["rickie", "bubba", "vijay", "max"],
    ],
    holesScored: 18,
    salt: 11,
    cards: { vijay: struggling, max: struggling },
    note: "Vijay and Max tie on the same struggling card",
  });
  await seed({
    date: dateFromToday(-35),
    course: bethpage,
    tee: "Blue",
    pairings: [
      ["scottie", "phil", "rory"],
      ["tyson", "rickie", "bubba", "rivers"],
    ],
    holesScored: 18,
    salt: 12,
    greenies: [
      {
        player: "bubba",
        hole: bethpage.parThrees[0],
        distance: { feet: 5, inches: 8 },
      },
      {
        player: "rivers",
        hole: bethpage.parThrees[3],
        distance: { feet: 2, inches: 1 },
      },
    ],
  });
  await seed({
    date: dateFromToday(-21),
    course: pebbleBeach,
    tee: "Blue",
    pairings: [
      ["scottie", "tyson", "rivers", "bubba"],
      ["phil", "rickie", "rory"],
    ],
    holesScored: 18,
    salt: 13,
  });
  await seed({
    date: dateFromToday(14),
    course: royalCountyDown,
    tee: "White",
    pairings: [["scottie", "phil", "tyson"]],
    holesScored: 0,
    salt: 14,
  });
  return routes;
}
