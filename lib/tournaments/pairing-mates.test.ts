import { afterEach, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  describe.skip("Pairing mates for a Round", () => {
    it("requires TEST_DATABASE_URL", () => {});
  });
} else {
  // The read exists so the play form can offer a player their pairing-mates
  // without the Tournament-by-id read growing a join for one consumer, so the
  // cases below are the ones that form asks: who else is in my Pairing, and
  // what have they already entered.
  describe("Pairing mates for a Round", async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.DATABASE_DRIVER = "node-postgres";
    const [{ db }, schema, queries] = await Promise.all([
      import("@/db"),
      import("@/db/schema"),
      import("./queries"),
    ]);
    const { inArray } = await import("drizzle-orm");

    const clubIds: number[] = [];
    const courseIds: number[] = [];
    const userIds: string[] = [];

    const PAR_FOUR_HOLE = 1;
    const PAR_THREE_HOLE = 2;

    async function tournamentFixture() {
      const suffix = crypto.randomUUID();
      const [course] = await db
        .insert(schema.courses)
        .values({ handle: `course-${suffix}`, name: `Course ${suffix}` })
        .returning();
      const [tee] = await db
        .insert(schema.courseTees)
        .values({ courseId: course.id, name: "Blue", rating: "72", slope: 120 })
        .returning();
      await db.insert(schema.courseHoles).values([
        { courseId: course.id, hole: PAR_FOUR_HOLE, par: 4, handicap: 1 },
        { courseId: course.id, hole: PAR_THREE_HOLE, par: 3, handicap: 2 },
      ]);
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
      const [tournament] = await db
        .insert(schema.tournaments)
        .values({
          seasonId: season.id,
          date: new Date("2026-01-01T00:00:00.000Z"),
          courseId: course.id,
          teeId: tee.id,
        })
        .returning();
      clubIds.push(club.id);
      courseIds.push(course.id);
      return { tournament, course, tee };
    }

    async function playerFixture(
      f: Awaited<ReturnType<typeof tournamentFixture>>,
      { lastName = crypto.randomUUID(), firstName = "Player" } = {},
    ) {
      const suffix = crypto.randomUUID();
      const [user] = await db
        .insert(schema.users)
        .values({
          email: `player-${suffix}@example.com`,
          firstName,
          lastName,
        })
        .returning();
      const [round] = await db
        .insert(schema.rounds)
        .values({
          tournamentId: f.tournament.id,
          userId: user.id,
          courseId: f.course.id,
          teeId: f.tee.id,
          date: f.tournament.date,
        })
        .returning();
      userIds.push(user.id);
      return { user, round };
    }

    async function pairingFixture(
      f: Awaited<ReturnType<typeof tournamentFixture>>,
      roundIds: number[],
      name = "Pairing 1",
    ) {
      const [pairing] = await db
        .insert(schema.pairings)
        .values({ tournamentId: f.tournament.id, name })
        .returning();
      if (roundIds.length) {
        await db.insert(schema.pairingMembers).values(
          roundIds.map((roundId) => ({
            tournamentId: f.tournament.id,
            pairingId: pairing.id,
            roundId,
          })),
        );
      }
      return pairing;
    }

    afterEach(async () => {
      if (userIds.length) {
        await db
          .delete(schema.rounds)
          .where(inArray(schema.rounds.userId, userIds));
      }
      if (clubIds.length) {
        const clubSeasonIds = (
          await db
            .select({ id: schema.seasons.id })
            .from(schema.seasons)
            .where(inArray(schema.seasons.clubId, clubIds))
        ).map((season) => season.id);
        if (clubSeasonIds.length) {
          await db
            .delete(schema.tournaments)
            .where(inArray(schema.tournaments.seasonId, clubSeasonIds));
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
    });

    it("returns the Round's pairing-mates and not the Round itself", async () => {
      const f = await tournamentFixture();
      const self = await playerFixture(f, { lastName: "Bravo" });
      const mate = await playerFixture(f, { lastName: "Alpha" });
      await pairingFixture(f, [self.round.id, mate.round.id]);

      expect(await queries.getPairingMatesForRound(self.round.id)).toMatchObject([
        { roundId: mate.round.id, userId: mate.user.id, lastName: "Alpha" },
      ]);
    });

    it("orders pairing-mates by name", async () => {
      const f = await tournamentFixture();
      const self = await playerFixture(f, { lastName: "Delta" });
      const charlie = await playerFixture(f, { lastName: "Charlie" });
      const alpha = await playerFixture(f, { lastName: "Alpha" });
      const bravo = await playerFixture(f, { lastName: "Bravo" });
      await pairingFixture(f, [
        self.round.id,
        charlie.round.id,
        alpha.round.id,
        bravo.round.id,
      ]);

      const mates = await queries.getPairingMatesForRound(self.round.id);
      expect(mates.map((mate) => mate.lastName)).toEqual([
        "Alpha",
        "Bravo",
        "Charlie",
      ]);
    });

    it("carries each mate's per-hole scores and Greenies", async () => {
      const f = await tournamentFixture();
      const self = await playerFixture(f);
      const mate = await playerFixture(f);
      await pairingFixture(f, [self.round.id, mate.round.id]);
      await db.insert(schema.roundScores).values([
        { roundId: mate.round.id, hole: PAR_FOUR_HOLE, strokes: 5, putts: 2 },
        { roundId: mate.round.id, hole: PAR_THREE_HOLE, strokes: 3, putts: 1 },
      ]);
      await db
        .insert(schema.greenies)
        .values({ roundId: mate.round.id, hole: PAR_THREE_HOLE, feet: 12, inches: 6 });

      expect(await queries.getPairingMatesForRound(self.round.id)).toMatchObject([
        {
          roundId: mate.round.id,
          scores: [
            { hole: PAR_FOUR_HOLE, par: 4, strokes: 5, putts: 2 },
            { hole: PAR_THREE_HOLE, par: 3, strokes: 3, putts: 1 },
          ],
          greenies: [{ hole: PAR_THREE_HOLE, feet: 12, inches: 6 }],
        },
      ]);
    });

    it("returns nothing for a Round in no Pairing", async () => {
      const f = await tournamentFixture();
      const self = await playerFixture(f);
      const other = await playerFixture(f);
      await pairingFixture(f, [other.round.id]);

      expect(await queries.getPairingMatesForRound(self.round.id)).toEqual([]);
    });

    it("excludes players in another Pairing of the same Tournament", async () => {
      const f = await tournamentFixture();
      const self = await playerFixture(f);
      const mate = await playerFixture(f);
      const stranger = await playerFixture(f);
      await pairingFixture(f, [self.round.id, mate.round.id], "Pairing 1");
      await pairingFixture(f, [stranger.round.id], "Pairing 2");

      const mates = await queries.getPairingMatesForRound(self.round.id);
      expect(mates.map(({ roundId }) => roundId)).toEqual([mate.round.id]);
    });
  });
}
