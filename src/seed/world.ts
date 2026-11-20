import { addDays, format } from "date-fns";

import { required } from "@/lib/required";
import type { PointRules } from "@/modules/clubs";
import { addClubMember, createClub } from "@/modules/clubs/server";
import { createCourse, getCourseForEdit } from "@/modules/courses/server";
import { createMatch, type MatchCreateInput } from "@/modules/matches/server";
import {
  createFirstPlatformAdmin,
  createPlayer,
  getAllPlayers,
} from "@/modules/players/server";
import {
  changeRoundSettings,
  createRound,
  getMatchRounds,
  getTournamentRounds,
  recordScorecardChanges,
} from "@/modules/rounds/server";
import {
  addPlayersToTournament,
  assignRoundToPairing,
  createPairing,
  createTournament,
} from "@/modules/tournaments/server";

// A small, fixed world for agents to render. Content is the same every run;
// ids are whatever the database hands out, and dates follow the day it runs
// so "upcoming" and "past" both have something in them. The Players and
// Courses borrow real names, but every score, index and rating is made up.

type HoleScore = { strokes: number; putts: number };
type Distance = { feet: number; inches: number };

type CoursePlan = {
  name: string;
  handle: string;
  pars: number[];
  handicaps: number[];
  tees: { name: string; color: string; rating: string; slope: number }[];
};

const PEBBLE_BEACH: CoursePlan = {
  name: "Pebble Beach Golf Links",
  handle: "pebble-beach",
  pars: [4, 5, 4, 4, 3, 5, 3, 4, 4, 4, 4, 3, 4, 5, 4, 4, 3, 5],
  handicaps: [9, 7, 13, 11, 17, 3, 15, 1, 5, 6, 12, 16, 2, 10, 8, 4, 18, 14],
  tees: [
    { name: "Blue", color: "#1d4ed8", rating: "74.9", slope: 144 },
    { name: "White", color: "#e5e7eb", rating: "72.1", slope: 136 },
  ],
};

// A short name, next to Pebble Beach's long one in course pickers.
const RIVIERA: CoursePlan = {
  name: "Riviera",
  handle: "riviera",
  pars: [5, 4, 4, 3, 4, 3, 4, 4, 4, 4, 5, 4, 4, 3, 4, 3, 5, 4],
  handicaps: [5, 9, 7, 15, 3, 17, 1, 11, 13, 4, 8, 14, 2, 16, 10, 18, 6, 12],
  tees: [{ name: "Gold", color: "#ca8a04", rating: "72.4", slope: 132 }],
};

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

const PLAYERS = {
  tiger: { firstName: "Tiger", lastName: "Woods", skill: -2 },
  phil: { firstName: "Phil", lastName: "Mickelson", skill: 0 },
  rory: { firstName: "Rory", lastName: "McIlroy", skill: 1 },
  scottie: { firstName: "Scottie", lastName: "Scheffler", skill: -1 },
  daly: { firstName: "John", lastName: "Daly", skill: 2 },
  jordan: { firstName: "Jordan", lastName: "Spieth", skill: 1 },
  annika: { firstName: "Annika", lastName: "Sörenstam", skill: 3 },
  // Long enough to wrap or truncate in tables and cards.
  christiaan: { firstName: "Christiaan", lastName: "Bezuidenhout", skill: 0 },
};
type PlayerKey = keyof typeof PLAYERS;
type PlayerIds = Record<PlayerKey, string>;

function ok<T extends { ok: boolean }>(
  result: T,
  what: string,
): Extract<T, { ok: true }> {
  if (!result.ok) {
    throw new Error(`Seeding ${what} failed: ${JSON.stringify(result)}`);
  }
  return result as Extract<T, { ok: true }>;
}

/** Looks up each Player's Round among an Event's Rounds. */
function roundsByPlayer(
  rounds: { id: number; playerId: string }[],
  ids: PlayerIds,
) {
  return (key: PlayerKey) =>
    required(
      rounds.find((round) => round.playerId === ids[key]),
      `${key}'s round`,
    ).id;
}

/** The card with only its first `holes` holes scored. */
function firstHoles(card: HoleScore[], holes: number) {
  return card.map((hole, i) => (i < holes ? hole : null));
}

/** yyyy-mm-dd, `offset` days from today. */
function dateFromToday(offset: number) {
  return format(addDays(new Date(), offset), "yyyy-MM-dd");
}

/** A fixed pseudo-random digit 0–9 for a Player's hole in one Event. */
function fixedDigit(salt: number, hole: number) {
  return (Math.imul(salt * 31 + hole, 2654435761) >>> 0) % 10;
}

/**
 * A believable card: `skill` below 0 plays better, above 0 worse. `salt`
 * makes each Player's card in each Event different but fixed.
 */
function scorecard(pars: number[], skill: number, salt: number): HoleScore[] {
  const overPar = [0, 0, 0, 1, 1, 1, 2, 2, 3];
  return pars.map((par, i) => {
    const r = fixedDigit(salt, i + 1);
    // About one birdie in ten holes, whatever the skill.
    const over =
      r === 0 ? -1 : overPar[Math.min(8, Math.max(0, r - 1 + skill))];
    const strokes = par + over;
    const putts = over < 0 || r === 4 ? 1 : r === 9 ? 3 : 2;
    return { strokes, putts: Math.min(putts, strokes - 1) };
  });
}

async function writeScores(
  adminId: string,
  roundId: number,
  card: (HoleScore | null)[],
) {
  const scores = card.flatMap((hole, i) =>
    hole ? [{ roundId, hole: i + 1, ...hole }] : [],
  );
  ok(await recordScorecardChanges(adminId, { scores }), "scores");
}

async function writeGreenie(
  adminId: string,
  roundId: number,
  hole: number,
  distance: Distance,
) {
  ok(
    await recordScorecardChanges(adminId, {
      greenies: [{ roundId, hole, distance }],
    }),
    "greenie",
  );
}

async function seedCourse(adminId: string, plan: CoursePlan) {
  ok(
    await createCourse(adminId, {
      handle: plan.handle,
      name: plan.name,
      imgUrl: "",
      tees: plan.tees.map((tee, t) => ({
        ...tee,
        // Back tees play about 25 yards longer per hole.
        yardages: plan.pars.map((par, i) => par * 90 + (i % 4) * 12 - t * 25),
        sortOrder: t,
      })),
      holes: plan.pars.map((par, i) => ({
        hole: i + 1,
        par,
        handicap: plan.handicaps[i],
      })),
    }),
    `course ${plan.handle}`,
  );
  const stored = required(
    await getCourseForEdit(plan.handle),
    `course ${plan.handle}`,
  );
  return {
    handle: stored.handle,
    pars: plan.pars,
    parThrees: plan.pars.flatMap((par, i) => (par === 3 ? [i + 1] : [])),
    tee: (name: string) =>
      required(
        stored.tees.find((t) => t.name === name),
        `${plan.handle} ${name} tee`,
      ).id,
  };
}
type SeededCourse = Awaited<ReturnType<typeof seedCourse>>;

async function seedPlayers(adminId: string): Promise<PlayerIds> {
  const ids = {} as PlayerIds;
  for (const [key, player] of Object.entries(PLAYERS)) {
    const created = ok(
      await createPlayer(adminId, {
        email: `${key}@example.com`,
        firstName: player.firstName,
        lastName: player.lastName,
        username: "",
        image: "",
        isAdmin: false,
      }),
      `player ${key}`,
    );
    ids[key as PlayerKey] = created.id;
  }
  return ids;
}

type TournamentPlan = {
  date: string;
  course: SeededCourse;
  tee: string;
  pairings: PlayerKey[][];
  /** 0 leaves the cards empty. */
  holesScored: number;
  salt: number;
  greenies?: { player: PlayerKey; hole: number; distance: Distance }[];
  aces?: { player: PlayerKey; hole: number }[];
};

async function seedTournament(
  adminId: string,
  ids: PlayerIds,
  clubHandle: string,
  plan: TournamentPlan,
) {
  const created = ok(
    await createTournament(adminId, {
      clubHandle,
      date: plan.date,
      courseHandle: plan.course.handle,
      teeId: plan.course.tee(plan.tee),
      seasonId: null,
      startNextSeason: false,
    }),
    `tournament on ${plan.date}`,
  );
  const tournamentId = required(created.id, "tournament id");
  const entrants = plan.pairings.flat();
  ok(
    await addPlayersToTournament(adminId, {
      tournamentId,
      playerIds: entrants.map((key) => ids[key]),
    }),
    "tournament players",
  );
  const { rounds } = await getTournamentRounds(tournamentId);
  const roundOf = roundsByPlayer(rounds, ids);

  for (const group of plan.pairings) {
    const pairing = ok(
      await createPairing(adminId, { tournamentId }),
      "pairing",
    );
    for (const key of group) {
      ok(
        await assignRoundToPairing(adminId, {
          pairingId: required(pairing.id, "pairing id"),
          roundId: roundOf(key),
        }),
        "pairing member",
      );
    }
  }

  if (plan.holesScored === 0) return;
  for (const [index, key] of entrants.entries()) {
    const card = firstHoles(
      scorecard(plan.course.pars, PLAYERS[key].skill, plan.salt * 10 + index),
      plan.holesScored,
    );
    for (const ace of plan.aces ?? []) {
      if (ace.player === key) card[ace.hole - 1] = { strokes: 1, putts: 0 };
    }
    await writeScores(adminId, roundOf(key), card);
  }
  for (const greenie of plan.greenies ?? []) {
    await writeGreenie(
      adminId,
      roundOf(greenie.player),
      greenie.hole,
      greenie.distance,
    );
  }
}

type MatchPlan = {
  creator: PlayerKey;
  format: MatchCreateInput["format"];
  date: string;
  course: SeededCourse;
  tee: string;
  players: PlayerKey[];
  teams?: [PlayerKey[], PlayerKey[]];
  /** Missing means the Round has no Player Index Override. */
  overrides: Partial<Record<PlayerKey, number>>;
};

async function seedMatch(adminId: string, ids: PlayerIds, plan: MatchPlan) {
  const [teamOne, teamTwo] = plan.teams ?? [[], []];
  const created = ok(
    await createMatch(ids[plan.creator], {
      date: plan.date,
      courseHandle: plan.course.handle,
      format: plan.format,
      teeId: plan.course.tee(plan.tee),
      playerIds: plan.players.map((key) => ids[key]),
      teamOnePlayerIds: teamOne.map((key) => ids[key]),
      teamTwoPlayerIds: teamTwo.map((key) => ids[key]),
    }),
    `${plan.format} match`,
  );
  const { rounds } = await getMatchRounds(required(created.id, "match id"));
  const roundOf = roundsByPlayer(rounds, ids);
  for (const [key, playerIndexOverride] of Object.entries(plan.overrides)) {
    ok(
      await changeRoundSettings(adminId, roundOf(key as PlayerKey), {
        playerIndexOverride,
      }),
      `${key}'s override`,
    );
  }
  return roundOf;
}

export async function seedWorld() {
  if ((await getAllPlayers()).length > 0) {
    throw new Error(
      "Refusing to seed: the database already has Players. Seed an empty, migrated database.",
    );
  }

  const adminId = ok(
    await createFirstPlatformAdmin({
      email: "admin@example.com",
      firstName: "Pat",
      lastName: "Admin",
    }),
    "Platform Admin",
  ).id;
  const ids = await seedPlayers(adminId);

  const pebble = await seedCourse(adminId, PEBBLE_BEACH);
  const riviera = await seedCourse(adminId, RIVIERA);

  const club = ok(
    await createClub(adminId, {
      handle: "saturday-club",
      name: "Saturday Club",
      logo: "",
      pointRules: POINT_RULES,
    }),
    "club",
  );
  for (const playerId of Object.values(ids)) {
    ok(await addClubMember(adminId, { clubId: club.id, playerId }), "member");
  }

  // Two finished Tournaments feed Standings, Counted Rounds, Tournament
  // Ranking and Tournament Skins. Annika plays only the second, so in the
  // third she has one prior Complete Round and plays off scratch.
  await seedTournament(adminId, ids, "saturday-club", {
    date: dateFromToday(-28),
    course: pebble,
    tee: "Blue",
    pairings: [
      ["tiger", "phil", "rory"],
      ["scottie", "daly", "christiaan"],
    ],
    holesScored: 18,
    salt: 1,
    greenies: [
      {
        player: "tiger",
        hole: pebble.parThrees[0],
        distance: { feet: 4, inches: 2 },
      },
      {
        player: "scottie",
        hole: pebble.parThrees[1],
        distance: { feet: 12, inches: 0 },
      },
      {
        player: "christiaan",
        hole: pebble.parThrees[3],
        distance: { feet: 2, inches: 7 },
      },
    ],
  });
  await seedTournament(adminId, ids, "saturday-club", {
    date: dateFromToday(-14),
    course: riviera,
    tee: "Gold",
    pairings: [
      ["tiger", "phil", "rory"],
      ["scottie", "annika", "christiaan"],
    ],
    holesScored: 18,
    salt: 2,
    aces: [{ player: "scottie", hole: riviera.parThrees[2] }],
    greenies: [
      {
        player: "rory",
        hole: riviera.parThrees[0],
        distance: { feet: 9, inches: 5 },
      },
      {
        player: "scottie",
        hole: riviera.parThrees[2],
        distance: { feet: 0, inches: 0 },
      },
    ],
  });
  await seedTournament(adminId, ids, "saturday-club", {
    date: dateFromToday(0),
    course: pebble,
    tee: "Blue",
    pairings: [["tiger", "phil", "rory", "annika"], ["jordan"]],
    holesScored: 9,
    salt: 3,
  });
  await seedTournament(adminId, ids, "saturday-club", {
    date: dateFromToday(7),
    course: riviera,
    tee: "Gold",
    pairings: [["tiger", "scottie", "daly"]],
    holesScored: 0,
    salt: 4,
  });

  const singles = await seedMatch(adminId, ids, {
    creator: "phil",
    format: "singles_match_play",
    date: dateFromToday(-7),
    course: pebble,
    tee: "Blue",
    players: ["phil", "jordan"],
    overrides: { phil: 8.4, jordan: 14 },
  });
  await writeScores(adminId, singles("phil"), scorecard(pebble.pars, 0, 51));
  await writeScores(adminId, singles("jordan"), scorecard(pebble.pars, 1, 52));

  // Christiaan has no override; Scottie's is a plus index.
  const threeBall = await seedMatch(adminId, ids, {
    creator: "rory",
    format: "three_ball_match_play",
    date: dateFromToday(-2),
    course: pebble,
    tee: "Blue",
    players: ["rory", "scottie", "christiaan"],
    overrides: { rory: 12.3, scottie: -1.2 },
  });
  ok(
    await changeRoundSettings(adminId, threeBall("christiaan"), {
      teeId: pebble.tee("White"),
    }),
    "Christiaan's tee",
  );
  for (const [key, skill, salt] of [
    ["rory", 1, 61],
    ["scottie", -2, 62],
    ["christiaan", 0, 63],
  ] as const) {
    await writeScores(
      adminId,
      threeBall(key),
      firstHoles(scorecard(pebble.pars, skill, salt), 9),
    );
  }

  // Annika sets it up but doesn't play. Tiger's birdie on 2 takes the skin
  // carried from hole 1, holes 3–5 tie and carry, and Jordan's birdie on 6
  // (net 3, with a stroke there) takes all 4.
  const fourBall = await seedMatch(adminId, ids, {
    creator: "annika",
    format: "four_ball_match_play",
    date: dateFromToday(0),
    course: pebble,
    tee: "Blue",
    players: ["tiger", "daly", "phil", "jordan"],
    teams: [
      ["tiger", "daly"],
      ["phil", "jordan"],
    ],
    overrides: { tiger: 10, daly: 11.2, phil: 10.6, jordan: 12.1 },
  });
  const fourBallCards: Partial<Record<PlayerKey, number[]>> = {
    tiger: [4, 4, 4, 4, 3, 5],
    daly: [4, 5, 4, 4, 3, 6],
    phil: [4, 5, 4, 4, 3, 5],
    jordan: [4, 5, 4, 4, 3, 4],
  };
  for (const [key, strokes] of Object.entries(fourBallCards)) {
    await writeScores(
      adminId,
      fourBall(key as PlayerKey),
      strokes.map((s) => ({ strokes: s, putts: Math.min(2, s - 1) })),
    );
  }
  await writeGreenie(adminId, fourBall("tiger"), pebble.parThrees[0], {
    feet: 6,
    inches: 2,
  });

  const casual = ok(
    await createRound(ids.daly, {
      courseHandle: riviera.handle,
      date: dateFromToday(-5),
      tournamentId: null,
      teeId: riviera.tee("Gold"),
    }),
    "casual round",
  );
  await writeScores(adminId, casual.roundId, scorecard(riviera.pars, 2, 71));
}
