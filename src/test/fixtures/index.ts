import { beforeEach } from "vitest";

import { required } from "@/lib/required";
import { addClubMember, createClub } from "@/modules/clubs/server";
import { HOLE_COUNT } from "@/modules/courses";
import {
  createCourse,
  getCourseForEdit,
  updateCourse,
  type CourseCreateInput,
  type CourseUpdateInput,
} from "@/modules/courses/server";
import { createMatch, type MatchCreateInput } from "@/modules/matches/server";
import { createPlayer } from "@/modules/players/server";
import {
  createRound,
  getMatchRounds,
  recordScorecardChanges,
} from "@/modules/rounds/server";
import {
  assignRoundToPairing,
  createPairing,
  createTournament,
  getTournamentById,
} from "@/modules/tournaments/server";
import { seedPlatformAdmin } from "@/test/db/seed";

export const PAR_THREE_HOLES = [3, 7, 12, 16];

const EVENT_DATE = "2026-01-01";

type ScorecardChanges = Parameters<typeof recordScorecardChanges>[1];
type HoleScoreChange = NonNullable<ScorecardChanges["scores"]>[number];
type GreenieChange = NonNullable<ScorecardChanges["greenies"]>[number];

const ZERO_POINT_RULES = {
  participation: 0,
  pars: 0,
  birdies: 0,
  eagles: 0,
  aces: 0,
  strokes: { positions: [0] },
  putts: { positions: [0] },
  greenies: { tiers: [{ maxFt: null, pts: 0 }] },
};

export type FixtureCourse = {
  id: number;
  handle: string;
  name: string;
  imgUrl: string | null;
};
export type FixtureTee = {
  id: number;
  courseId: number;
  name: string;
  color: string | null;
  rating: string;
  slope: number;
};
export type FixturePlayer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
};
export type FixtureRound = {
  id: number;
  playerId: string;
  courseId: number;
  teeId: number;
  date: Date;
  tournamentId: number | null;
  matchId: number | null;
};

function ok<T extends { ok: boolean }>(
  result: T,
  what: string,
): Extract<T, { ok: true }> {
  if (!result.ok) {
    throw new Error(`${what} failed: ${JSON.stringify(result)}`);
  }
  return result as Extract<T, { ok: true }>;
}

function standardHoles() {
  return Array.from({ length: HOLE_COUNT }, (_, index) => ({
    hole: index + 1,
    par: PAR_THREE_HOLES.includes(index + 1) ? 3 : 4,
    handicap: index + 1,
  }));
}

function blankYardages() {
  return Array.from({ length: HOLE_COUNT }, () => "" as const);
}

/**
 * Arranges data through module entry points only. Every write acts as a
 * Platform Admin seeded on first use in each test.
 */
export function createFixtures() {
  let seeded: Promise<{ id: string }> | undefined;
  beforeEach(() => {
    seeded = undefined;
  });

  async function admin() {
    seeded ??= seedPlatformAdmin();
    return (await seeded).id;
  }

  async function player({
    isAdmin = false,
    firstName = "Player",
    lastName = crypto.randomUUID(),
  } = {}): Promise<FixturePlayer> {
    const values = {
      email: `player-${crypto.randomUUID()}@example.com`,
      firstName,
      lastName,
      username: "",
      image: "",
      isAdmin,
    };
    const created = ok(await createPlayer(await admin(), values), "player");
    return {
      id: created.id,
      email: created.email,
      firstName: values.firstName,
      lastName: values.lastName,
      isAdmin,
    };
  }

  async function course(
    overrides: Partial<CourseCreateInput> = {},
  ): Promise<{ course: FixtureCourse; tee: FixtureTee }> {
    const suffix = crypto.randomUUID();
    const values: CourseCreateInput = {
      handle: `course-${suffix}`,
      name: `Course ${suffix}`,
      imgUrl: "",
      tees: [
        {
          name: "Blue",
          color: "",
          rating: "72",
          slope: 120,
          yardages: blankYardages(),
          sortOrder: 0,
        },
      ],
      holes: standardHoles(),
      ...overrides,
    };
    const created = ok(await createCourse(await admin(), values), "course");
    const stored = required(
      await getCourseForEdit(created.handle),
      "created course",
    );
    const [firstTee] = stored.tees;
    return {
      course: {
        id: stored.id,
        handle: stored.handle,
        name: stored.name,
        imgUrl: stored.imgUrl,
      },
      tee: {
        id: firstTee.id,
        courseId: stored.id,
        name: firstTee.name,
        color: firstTee.color,
        rating: firstTee.rating,
        slope: firstTee.slope,
      },
    };
  }

  // Saves the course with `edit` applied to its current tees, keeping
  // everything else.
  async function editTees(
    courseHandle: string,
    edit: (tees: CourseUpdateInput["tees"]) => CourseUpdateInput["tees"],
  ) {
    const current = required(
      await getCourseForEdit(courseHandle),
      "course to edit",
    );
    const tees: CourseUpdateInput["tees"] = current.tees.map((existing) => ({
      id: existing.id,
      name: existing.name,
      color: existing.color ?? "",
      rating: existing.rating,
      slope: existing.slope,
      yardages: existing.yardages.map((yards) => yards ?? ("" as const)),
      sortOrder: existing.sortOrder,
    }));
    ok(
      await updateCourse(await admin(), {
        id: current.id,
        handle: current.handle,
        name: current.name,
        imgUrl: current.imgUrl ?? "",
        tees: edit(tees),
        holes: current.holes,
      }),
      "editTees",
    );
    return current.id;
  }

  /** Adds a tee to the course, keeping its existing tees and holes. */
  async function tee(courseHandle: string, name = "White"): Promise<FixtureTee> {
    const courseId = await editTees(courseHandle, (tees) => [
      ...tees,
      {
        name,
        color: "",
        rating: "70",
        slope: 115,
        yardages: blankYardages(),
        sortOrder: tees.length,
      },
    ]);
    const added = required(
      (await getCourseForEdit(courseHandle))?.tees.find(
        (stored) => stored.name === name,
      ),
      "added tee",
    );
    return {
      id: added.id,
      courseId,
      name,
      color: added.color,
      rating: added.rating,
      slope: added.slope,
    };
  }

  /** Sets a tee's 18 hole yardages. */
  async function yardages(courseHandle: string, teeId: number, yards: number[]) {
    await editTees(courseHandle, (tees) =>
      tees.map((t) => (t.id === teeId ? { ...t, yardages: yards } : t)),
    );
  }

  async function club() {
    const suffix = crypto.randomUUID();
    const handle = `club-${suffix}`;
    const created = ok(
      await createClub(await admin(), {
        handle,
        name: `Club ${suffix}`,
        logo: "",
        pointRules: ZERO_POINT_RULES,
      }),
      "club",
    );
    return { id: created.id, handle };
  }

  async function clubMember(clubId: number, playerId: string) {
    ok(await addClubMember(await admin(), { clubId, playerId }), "clubMember");
  }

  async function tournament({
    date = EVENT_DATE,
    club: owner,
    seasonId = null,
    startNextSeason = false,
    on,
  }: {
    date?: string;
    club?: { id: number; handle: string };
    /** Defaults to a new course. */
    on?: { course: FixtureCourse; tee: FixtureTee };
    /** Null places it in the Club's Current Season. */
    seasonId?: number | null;
    startNextSeason?: boolean;
  } = {}) {
    const { course: tournamentCourse, tee: tournamentTee } =
      on ?? (await course());
    const tournamentClub = owner ?? (await club());
    const created = ok(
      await createTournament(await admin(), {
        clubHandle: tournamentClub.handle,
        date,
        courseHandle: tournamentCourse.handle,
        teeId: tournamentTee.id,
        seasonId,
        startNextSeason,
      }),
      "tournament",
    );
    const stored = required(
      await getTournamentById(required(created.id, "tournament id")),
      "created tournament",
    );
    return {
      tournament: {
        id: stored.id,
        seasonId: stored.seasonId,
        date: stored.date,
        courseId: stored.courseId,
        teeId: stored.teeId,
      },
      club: tournamentClub,
      course: tournamentCourse,
      tee: tournamentTee,
    };
  }

  type Tournament = Awaited<ReturnType<typeof tournament>>;

  async function tournamentPlayer(t: Tournament, entrant?: FixturePlayer) {
    const tournamentEntrant = entrant ?? (await player());
    const created = ok(
      await createRound(tournamentEntrant.id, {
        courseHandle: t.course.handle,
        date: EVENT_DATE,
        tournamentId: t.tournament.id,
        teeId: null,
      }),
      "tournamentPlayer",
    );
    const round: FixtureRound = {
      id: created.roundId,
      playerId: tournamentEntrant.id,
      courseId: t.tournament.courseId,
      teeId: t.tournament.teeId,
      date: t.tournament.date,
      tournamentId: t.tournament.id,
      matchId: null,
    };
    return { player: tournamentEntrant, round };
  }

  async function casualRound(
    playerId: string,
    { courseHandle, teeId, date = EVENT_DATE }: {
      courseHandle: string;
      teeId: number;
      date?: string;
    },
  ) {
    const created = ok(
      await createRound(playerId, {
        courseHandle,
        date,
        tournamentId: null,
        teeId,
      }),
      "casualRound",
    );
    return created.roundId;
  }

  async function pairing(tournamentId: number, roundIds: number[]) {
    const actor = await admin();
    const created = ok(
      await createPairing(actor, { tournamentId }),
      "pairing",
    );
    const pairingId = required(created.id, "pairing id");
    for (const roundId of roundIds) {
      ok(
        await assignRoundToPairing(actor, { pairingId, roundId }),
        "pairing member",
      );
    }
    return pairingId;
  }

  // The creator plays unless `creatorPlays` is false, in which case every
  // player is someone else.
  async function match(
    playerCount: number,
    {
      creatorPlays = true,
      format = "singles_match_play",
      teams = [[], []],
    }: {
      creatorPlays?: boolean;
      format?: MatchCreateInput["format"];
      /** Four-Ball teams, as indexes into the Match's players. */
      teams?: [number[], number[]];
    } = {},
  ) {
    const { course: matchCourse, tee: matchTee } = await course();
    const creator = await player();
    const matchPlayers: FixturePlayer[] = [];
    for (let i = 0; i < playerCount; i += 1) {
      matchPlayers.push(i === 0 && creatorPlays ? creator : await player());
    }
    const created = ok(
      await createMatch(creator.id, {
        date: EVENT_DATE,
        courseHandle: matchCourse.handle,
        format,
        teeId: matchTee.id,
        playerIds: matchPlayers.map((p) => p.id),
        teamOnePlayerIds: teams[0].map((i) => matchPlayers[i].id),
        teamTwoPlayerIds: teams[1].map((i) => matchPlayers[i].id),
      }),
      "match",
    );
    const matchId = required(created.id, "match id");
    const { rounds } = await getMatchRounds(matchId);
    const date = new Date(`${EVENT_DATE}T00:00:00.000Z`);
    const players = matchPlayers.map((matchPlayer) => {
      const stored = required(
        rounds.find((r) => r.playerId === matchPlayer.id),
        "match round",
      );
      const round: FixtureRound = {
        id: stored.id,
        playerId: matchPlayer.id,
        courseId: matchCourse.id,
        teeId: matchTee.id,
        date,
        tournamentId: null,
        matchId,
      };
      return { player: matchPlayer, round };
    });
    return {
      match: {
        id: matchId,
        courseId: matchCourse.id,
        courseHandle: matchCourse.handle,
        createdByPlayerId: creator.id,
        date,
      },
      course: matchCourse,
      tee: matchTee,
      creator,
      players,
    };
  }

  /** Records strokes (and optional putts) per hole, 1-based, as an admin. */
  async function scores(
    roundId: number,
    holes: { hole: number; strokes: number | null; putts?: number | null }[],
  ) {
    const changes: HoleScoreChange[] = holes.map((hole) => ({
      roundId,
      ...hole,
    }));
    ok(
      await recordScorecardChanges(await admin(), { scores: changes }),
      "scores",
    );
  }

  async function greenie(
    roundId: number,
    hole: number,
    distance: GreenieChange["distance"],
  ) {
    ok(
      await recordScorecardChanges(await admin(), {
        greenies: [{ roundId, hole, distance }],
      }),
      "greenie",
    );
  }

  return {
    admin,
    player,
    course,
    tee,
    yardages,
    club,
    clubMember,
    tournament,
    tournamentPlayer,
    casualRound,
    pairing,
    match,
    scores,
    greenie,
  };
}

export type Fixtures = ReturnType<typeof createFixtures>;
