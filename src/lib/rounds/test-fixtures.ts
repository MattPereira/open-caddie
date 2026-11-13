import type { db as Db } from "@/db";
import type * as Schema from "@/db/schema";
import { HOLE_COUNT } from "@/lib/rounds/completeness";

export function createRoundFixtures(db: typeof Db, schema: typeof Schema) {
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
      Array.from({ length: HOLE_COUNT }, (_, index) => ({
        courseId: created.id,
        hole: index + 1,
        par: PAR_THREE_HOLES.includes(index + 1) ? 3 : 4,
        handicap: index + 1,
      })),
    );
    return { course: created, tee };
  }

  async function tee(courseId: number, name = "White") {
    const [created] = await db
      .insert(schema.courseTees)
      .values({ courseId, name, rating: "70", slope: 115 })
      .returning();
    return created;
  }

  async function player({ isAdmin = false } = {}) {
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
    const entrant = await player();
    const [round] = await db
      .insert(schema.rounds)
      .values({
        tournamentId: t.tournament.id,
        playerId: entrant.id,
        courseId: t.course.id,
        teeId: t.tee.id,
        date: t.tournament.date,
      })
      .returning();
    return { player: entrant, round };
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
    const creator = await player();
    const [created] = await db
      .insert(schema.matches)
      .values({
        createdByPlayerId: creator.id,
        courseId: matchCourse.id,
        date: new Date("2026-01-01T00:00:00.000Z"),
      })
      .returning();
    const players = [];
    for (let i = 0; i < playerCount; i += 1) {
      const matchPlayer = i === 0 && creatorPlays ? creator : await player();
      const [round] = await db
        .insert(schema.rounds)
        .values({
          matchId: created.id,
          playerId: matchPlayer.id,
          courseId: matchCourse.id,
          teeId: tee.id,
          date: created.date,
        })
        .returning();
      players.push({ player: matchPlayer, round });
    }
    return { match: created, creator, players };
  }

  return { course, tee, player, tournament, tournamentPlayer, pairing, match };
}

export const PAR_THREE_HOLES = [3, 7, 12, 16];
