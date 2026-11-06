import { inArray } from "drizzle-orm";

import type { db as Db } from "@/db";
import type * as Schema from "@/db/schema";

// Fixtures shared by the Round suites that run against TEST_DATABASE_URL.
// Callers import `@/db` themselves after pointing DATABASE_URL at the test
// database, then hand the client and schema in here.
export function createRoundFixtures(db: typeof Db, schema: typeof Schema) {
  const clubIds: number[] = [];
  const courseIds: number[] = [];
  const userIds: string[] = [];
  const matchIds: number[] = [];

  async function course() {
    const suffix = crypto.randomUUID();
    const [created] = await db
      .insert(schema.courses)
      .values({ handle: `course-${suffix}`, name: `Course ${suffix}` })
      .returning();
    const [tee] = await db
      .insert(schema.courseTees)
      .values({ courseId: created.id, name: "Blue", rating: "72", slope: 120 })
      .returning();
    await db.insert(schema.courseHoles).values(
      Array.from({ length: 18 }, (_, index) => ({
        courseId: created.id,
        hole: index + 1,
        par: PAR_THREE_HOLES.includes(index + 1) ? 3 : 4,
        handicap: index + 1,
      })),
    );
    courseIds.push(created.id);
    return { course: created, tee };
  }

  async function tee(courseId: number, name = "White") {
    const [created] = await db
      .insert(schema.courseTees)
      .values({ courseId, name, rating: "70", slope: 115 })
      .returning();
    return created;
  }

  async function user({ isAdmin = false } = {}) {
    const suffix = crypto.randomUUID();
    const [created] = await db
      .insert(schema.users)
      .values({
        email: `player-${suffix}@example.com`,
        firstName: "Player",
        lastName: suffix,
        isAdmin,
      })
      .returning();
    userIds.push(created.id);
    return created;
  }

  async function tournament() {
    const suffix = crypto.randomUUID();
    const { course: tournamentCourse, tee } = await course();
    const [club] = await db
      .insert(schema.clubs)
      .values({
        handle: `club-${suffix}`,
        name: `Club ${suffix}`,
        pointRules: {
          participation: 0,
          pars: 0,
          birdies: 0,
          eagles: 0,
          aces: 0,
          strokes: { positions: [0] },
          putts: { positions: [0] },
          greenies: { tiers: [{ maxFt: null, pts: 0 }] },
        },
      })
      .returning();
    clubIds.push(club.id);
    const [season] = await db
      .insert(schema.seasons)
      .values({ clubId: club.id, number: 1 })
      .returning();
    const [created] = await db
      .insert(schema.tournaments)
      .values({
        seasonId: season.id,
        date: new Date("2026-01-01T00:00:00.000Z"),
        courseId: tournamentCourse.id,
        teeId: tee.id,
      })
      .returning();
    return { tournament: created, course: tournamentCourse, tee };
  }

  async function tournamentPlayer(t: Awaited<ReturnType<typeof tournament>>) {
    const player = await user();
    const [round] = await db
      .insert(schema.rounds)
      .values({
        tournamentId: t.tournament.id,
        userId: player.id,
        courseId: t.course.id,
        teeId: t.tee.id,
        date: t.tournament.date,
      })
      .returning();
    return { user: player, round };
  }

  async function pairing(tournamentId: number, roundIds: number[]) {
    const [created] = await db
      .insert(schema.pairings)
      .values({ tournamentId, name: "Pairing" })
      .returning();
    if (roundIds.length) {
      await db.insert(schema.pairingMembers).values(
        roundIds.map((roundId) => ({
          tournamentId,
          pairingId: created.id,
          roundId,
        })),
      );
    }
    return created.id;
  }

  // The creator plays unless `creatorPlays` is false, in which case every
  // player is someone else.
  async function match(playerCount: number, { creatorPlays = true } = {}) {
    const { course: matchCourse, tee } = await course();
    const creator = await user();
    const [created] = await db
      .insert(schema.matches)
      .values({
        createdByUserId: creator.id,
        courseId: matchCourse.id,
        date: new Date("2026-01-01T00:00:00.000Z"),
      })
      .returning();
    matchIds.push(created.id);
    const players = [];
    for (let i = 0; i < playerCount; i += 1) {
      const player = i === 0 && creatorPlays ? creator : await user();
      const [round] = await db
        .insert(schema.rounds)
        .values({
          matchId: created.id,
          userId: player.id,
          courseId: matchCourse.id,
          teeId: tee.id,
          date: created.date,
        })
        .returning();
      players.push({ user: player, round });
    }
    return { match: created, creator, players };
  }

  async function cleanup() {
    if (userIds.length) {
      await db
        .delete(schema.rounds)
        .where(inArray(schema.rounds.userId, userIds));
    }
    if (matchIds.length) {
      await db
        .delete(schema.matches)
        .where(inArray(schema.matches.id, matchIds));
    }
    if (clubIds.length) {
      const seasonIds = (
        await db
          .select({ id: schema.seasons.id })
          .from(schema.seasons)
          .where(inArray(schema.seasons.clubId, clubIds))
      ).map((season) => season.id);
      if (seasonIds.length) {
        await db
          .delete(schema.tournaments)
          .where(inArray(schema.tournaments.seasonId, seasonIds));
      }
      await db.delete(schema.clubs).where(inArray(schema.clubs.id, clubIds));
    }
    if (courseIds.length) {
      await db
        .delete(schema.courses)
        .where(inArray(schema.courses.id, courseIds));
    }
    if (userIds.length) {
      await db.delete(schema.users).where(inArray(schema.users.id, userIds));
    }
    clubIds.length = 0;
    courseIds.length = 0;
    userIds.length = 0;
    matchIds.length = 0;
  }

  return { course, tee, user, tournament, tournamentPlayer, pairing, match, cleanup };
}

export const PAR_THREE_HOLES = [3, 7, 12, 16];
