import { addDays, format } from "date-fns";

import { required } from "@/lib/required";
import type { PointRules } from "@/modules/clubs";
import { addClubMember, createClub } from "@/modules/clubs/server";
import {
  createCourse,
  getCourseForEdit,
  type CourseCreateInput,
} from "@/modules/courses/server";
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
// so "upcoming" and "past" both have something in them.

type HoleScore = { strokes: number; putts: number };
type Distance = { feet: number; inches: number };

const PARS = [4, 5, 4, 3, 4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5, 4];
const HANDICAPS = [
  7, 1, 11, 17, 3, 9, 15, 5, 13, 8, 16, 2, 12, 4, 18, 10, 6, 14,
];
const PAR_THREES = PARS.flatMap((par, i) => (par === 3 ? [i + 1] : []));

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
  ada: { firstName: "Ada", lastName: "Okafor", skill: -2 },
  ben: { firstName: "Ben", lastName: "Hartley", skill: 0 },
  cara: { firstName: "Cara", lastName: "Lindqvist", skill: 1 },
  dev: { firstName: "Dev", lastName: "Raman", skill: -1 },
  eli: { firstName: "Eli", lastName: "Navarro", skill: 2 },
  finn: { firstName: "Finn", lastName: "Doyle", skill: 1 },
  gwen: { firstName: "Gwen", lastName: "Ito", skill: 3 },
  // Long enough to wrap or truncate in tables and cards.
  max: {
    firstName: "Maximiliana",
    lastName: "Featherstonehaugh-Worthington",
    skill: 0,
  },
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

function day(offset: number) {
  return format(addDays(new Date(), offset), "yyyy-MM-dd");
}

/** A fixed pseudo-random digit 0–9 for a Player's hole in one Event. */
function digit(salt: number, hole: number) {
  return (Math.imul(salt * 31 + hole, 2654435761) >>> 0) % 10;
}

/**
 * A believable card: `skill` below 0 plays better, above 0 worse. `salt`
 * makes each Player's card in each Event different but fixed.
 */
function scorecard(skill: number, salt: number): HoleScore[] {
  const overPar = [0, 0, 0, 1, 1, 1, 2, 2, 3];
  return PARS.map((par, i) => {
    const r = digit(salt, i + 1);
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

function course(
  name: string,
  handle: string,
  tees: { name: string; color: string; rating: string; slope: number }[],
): CourseCreateInput {
  return {
    handle,
    name,
    imgUrl: "",
    tees: tees.map((tee, t) => ({
      ...tee,
      // Back tees play about 25 yards longer per hole.
      yardages: PARS.map((par, i) => par * 90 + (i % 4) * 12 - t * 25),
      sortOrder: t,
    })),
    holes: PARS.map((par, i) => ({
      hole: i + 1,
      par,
      handicap: HANDICAPS[i],
    })),
  };
}

async function createSeedCourse(adminId: string, values: CourseCreateInput) {
  ok(await createCourse(adminId, values), `course ${values.handle}`);
  const stored = required(
    await getCourseForEdit(values.handle),
    `course ${values.handle}`,
  );
  const tee = (name: string) =>
    required(
      stored.tees.find((t) => t.name === name),
      `${values.handle} ${name} tee`,
    ).id;
  return { handle: stored.handle, tee };
}

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
  courseHandle: string;
  teeId: number;
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
      courseHandle: plan.courseHandle,
      teeId: plan.teeId,
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
      scorecard(PLAYERS[key].skill, plan.salt * 10 + index),
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
  courseHandle: string;
  teeId: number;
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
      courseHandle: plan.courseHandle,
      format: plan.format,
      teeId: plan.teeId,
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

  const cedar = await createSeedCourse(
    adminId,
    course("Cedar Ridge Golf Club", "cedar-ridge", [
      { name: "Blue", color: "#1d4ed8", rating: "72.1", slope: 131 },
      { name: "White", color: "#e5e7eb", rating: "69.8", slope: 124 },
    ]),
  );
  const oaks = await createSeedCourse(
    adminId,
    course("Oaks", "oaks", [
      { name: "Gold", color: "#ca8a04", rating: "70.4", slope: 122 },
    ]),
  );

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
  // Ranking and Tournament Skins. Gwen plays only the second, so in the third
  // she has one prior Complete Round and plays off scratch.
  await seedTournament(adminId, ids, "saturday-club", {
    date: day(-28),
    courseHandle: cedar.handle,
    teeId: cedar.tee("Blue"),
    pairings: [
      ["ada", "ben", "cara"],
      ["dev", "eli", "max"],
    ],
    holesScored: 18,
    salt: 1,
    greenies: [
      { player: "ada", hole: PAR_THREES[0], distance: { feet: 4, inches: 2 } },
      { player: "dev", hole: PAR_THREES[1], distance: { feet: 12, inches: 0 } },
      { player: "max", hole: PAR_THREES[3], distance: { feet: 2, inches: 7 } },
    ],
  });
  await seedTournament(adminId, ids, "saturday-club", {
    date: day(-14),
    courseHandle: oaks.handle,
    teeId: oaks.tee("Gold"),
    pairings: [
      ["ada", "ben", "cara"],
      ["dev", "gwen", "max"],
    ],
    holesScored: 18,
    salt: 2,
    aces: [{ player: "dev", hole: PAR_THREES[2] }],
    greenies: [
      { player: "cara", hole: PAR_THREES[0], distance: { feet: 9, inches: 5 } },
      { player: "dev", hole: PAR_THREES[2], distance: { feet: 0, inches: 0 } },
    ],
  });
  await seedTournament(adminId, ids, "saturday-club", {
    date: day(0),
    courseHandle: cedar.handle,
    teeId: cedar.tee("Blue"),
    pairings: [["ada", "ben", "cara", "gwen"], ["finn"]],
    holesScored: 9,
    salt: 3,
  });
  await seedTournament(adminId, ids, "saturday-club", {
    date: day(7),
    courseHandle: oaks.handle,
    teeId: oaks.tee("Gold"),
    pairings: [["ada", "dev", "eli"]],
    holesScored: 0,
    salt: 4,
  });

  const singles = await seedMatch(adminId, ids, {
    creator: "ben",
    format: "singles_match_play",
    date: day(-7),
    courseHandle: cedar.handle,
    teeId: cedar.tee("Blue"),
    players: ["ben", "finn"],
    overrides: { ben: 8.4, finn: 14 },
  });
  await writeScores(adminId, singles("ben"), scorecard(0, 51));
  await writeScores(adminId, singles("finn"), scorecard(1, 52));

  // Max has no override; Dev's is a plus index.
  const threeBall = await seedMatch(adminId, ids, {
    creator: "cara",
    format: "three_ball_match_play",
    date: day(-2),
    courseHandle: cedar.handle,
    teeId: cedar.tee("Blue"),
    players: ["cara", "dev", "max"],
    overrides: { cara: 12.3, dev: -1.2 },
  });
  ok(
    await changeRoundSettings(adminId, threeBall("max"), {
      teeId: cedar.tee("White"),
    }),
    "Max's tee",
  );
  for (const [key, skill, salt] of [
    ["cara", 1, 61],
    ["dev", -2, 62],
    ["max", 0, 63],
  ] as const) {
    await writeScores(
      adminId,
      threeBall(key),
      firstHoles(scorecard(skill, salt), 9),
    );
  }

  // Gwen sets it up but doesn't play. The overrides are close, so strokes
  // fall only on the hardest holes and gross decides holes 4–6: 4 and 5 tie
  // and carry, and Finn's birdie on 6 takes the carry-over.
  const fourBall = await seedMatch(adminId, ids, {
    creator: "gwen",
    format: "four_ball_match_play",
    date: day(0),
    courseHandle: cedar.handle,
    teeId: cedar.tee("Blue"),
    players: ["ada", "eli", "ben", "finn"],
    teams: [
      ["ada", "eli"],
      ["ben", "finn"],
    ],
    overrides: { ada: 10, eli: 11.2, ben: 10.6, finn: 12.1 },
  });
  const fourBallCards: Record<"ada" | "eli" | "ben" | "finn", number[]> = {
    ada: [4, 5, 3, 3, 4, 5],
    eli: [4, 6, 5, 3, 4, 5],
    ben: [4, 5, 5, 3, 4, 5],
    finn: [4, 6, 5, 3, 4, 3],
  };
  for (const [key, strokes] of Object.entries(fourBallCards)) {
    await writeScores(
      adminId,
      fourBall(key as PlayerKey),
      strokes.map((s) => ({ strokes: s, putts: Math.min(2, s - 1) })),
    );
  }
  await writeGreenie(adminId, fourBall("ada"), 4, { feet: 6, inches: 2 });

  const casual = ok(
    await createRound(ids.eli, {
      courseHandle: oaks.handle,
      date: day(-5),
      tournamentId: null,
      teeId: oaks.tee("Gold"),
    }),
    "casual round",
  );
  await writeScores(adminId, casual.roundId, scorecard(2, 71));

  console.log(
    `Seeded ${Object.keys(ids).length + 1} Players, 2 Courses, 1 Club, 4 Tournaments, 3 Matches and 1 casual Round.`,
  );
}
