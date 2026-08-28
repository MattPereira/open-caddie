import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));

// Pairing setup goes through the admin-only Pairing actions, whose admin check
// is a React-cached read. The code under test reads `users.isAdmin` directly,
// so stubbing this leaves every admin case in this file genuinely exercised.
const getCurrentUser = vi.hoisted(() =>
  vi.fn(async (): Promise<{ isAdmin: boolean } | null> => ({ isAdmin: true })),
);
vi.mock("@/lib/users/queries", () => ({ getCurrentUser }));

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  describe.skip("Round write access", () => {
    it("requires TEST_DATABASE_URL", () => {});
  });
} else {
  // The authorization helper is private, so every case is driven through the
  // exported score and greenie actions — the surface a peer scorer actually hits.
  describe("Round write access", async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.DATABASE_DRIVER = "node-postgres";
    const [{ db }, schema, roundActions, tournamentActions, { auth }] =
      await Promise.all([
        import("@/db"),
        import("@/db/schema"),
        import("@/app/(app)/rounds/actions"),
        import("@/app/(app)/tournaments/actions"),
        import("@/auth"),
      ]);
    const { and, eq, inArray } = await import("drizzle-orm");

    const clubIds: number[] = [];
    const courseIds: number[] = [];
    const userIds: string[] = [];
    const matchIds: number[] = [];

    // The par 3 a Greenie needs, plus a par 4 for ordinary strokes.
    const PAR_THREE_HOLE = 2;
    const PAR_FOUR_HOLE = 1;

    function signInAs(userId: string) {
      vi.mocked(auth).mockResolvedValue({
        user: { id: userId },
      } as unknown as Awaited<ReturnType<typeof auth>>);
    }

    async function courseFixture() {
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
      courseIds.push(course.id);
      return { course, tee };
    }

    async function tournamentFixture() {
      const suffix = crypto.randomUUID();
      const { course, tee } = await courseFixture();
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
      return { tournament, course, tee };
    }

    async function userFixture({ isAdmin = false } = {}) {
      const suffix = crypto.randomUUID();
      const [user] = await db
        .insert(schema.users)
        .values({
          email: `player-${suffix}@example.com`,
          firstName: "Player",
          lastName: suffix,
          isAdmin,
        })
        .returning();
      userIds.push(user.id);
      return user;
    }

    async function playerFixture(
      f: Awaited<ReturnType<typeof tournamentFixture>>,
    ) {
      const user = await userFixture();
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
      return { user, round };
    }

    async function pairingFixture(tournamentId: number, roundIds: number[]) {
      const created = await tournamentActions.createPairing({ tournamentId });
      if (!created.ok || created.id == null) {
        throw new Error(created.ok ? "Missing Pairing id" : created.error);
      }
      for (const roundId of roundIds) {
        const assigned = await tournamentActions.assignRoundToPairing({
          pairingId: created.id,
          roundId,
        });
        if (!assigned.ok) throw new Error(assigned.error);
      }
      return created.id;
    }

    async function matchFixture(playerCount: number) {
      const { course, tee } = await courseFixture();
      const creator = await userFixture();
      const [match] = await db
        .insert(schema.matches)
        .values({
          createdByUserId: creator.id,
          courseId: course.id,
          date: new Date("2026-01-01T00:00:00.000Z"),
        })
        .returning();
      matchIds.push(match.id);
      const players = [];
      for (let i = 0; i < playerCount; i += 1) {
        const user = i === 0 ? creator : await userFixture();
        const [round] = await db
          .insert(schema.rounds)
          .values({
            matchId: match.id,
            userId: user.id,
            courseId: course.id,
            teeId: tee.id,
            date: match.date,
          })
          .returning();
        players.push({ user, round });
      }
      return { match, players };
    }

    async function scoreOf(roundId: number, hole: number) {
      const [score] = await db
        .select()
        .from(schema.roundScores)
        .where(
          and(
            eq(schema.roundScores.roundId, roundId),
            eq(schema.roundScores.hole, hole),
          ),
        );
      return score;
    }

    async function greenieOf(roundId: number, hole: number) {
      const [greenie] = await db
        .select()
        .from(schema.greenies)
        .where(
          and(
            eq(schema.greenies.roundId, roundId),
            eq(schema.greenies.hole, hole),
          ),
        );
      return greenie;
    }

    // Both write surfaces are asserted together everywhere, because the
    // authorization branch they share is the whole subject of this file.
    async function expectWritesAllowed(
      roundId: number,
      { strokes, feet }: { strokes: number; feet: number },
    ) {
      expect(
        await roundActions.upsertRoundScore({
          roundId,
          hole: PAR_FOUR_HOLE,
          strokes,
          putts: 2,
        }),
      ).toMatchObject({ ok: true });
      expect(
        await roundActions.upsertRoundGreenie({
          roundId,
          hole: PAR_THREE_HOLE,
          feet,
          inches: 3,
        }),
      ).toMatchObject({ ok: true });
      expect(await scoreOf(roundId, PAR_FOUR_HOLE)).toMatchObject({
        strokes,
        putts: 2,
      });
      expect(await greenieOf(roundId, PAR_THREE_HOLE)).toMatchObject({
        feet,
        inches: 3,
      });
    }

    async function expectWritesRejected(roundId: number) {
      expect(
        await roundActions.upsertRoundScore({
          roundId,
          hole: PAR_FOUR_HOLE,
          strokes: 5,
          putts: 2,
        }),
      ).toMatchObject({ ok: false });
      expect(
        await roundActions.upsertRoundGreenie({
          roundId,
          hole: PAR_THREE_HOLE,
          feet: 12,
          inches: 3,
        }),
      ).toMatchObject({ ok: false });
      expect(await scoreOf(roundId, PAR_FOUR_HOLE)).toBeUndefined();
      expect(await greenieOf(roundId, PAR_THREE_HOLE)).toBeUndefined();
    }

    beforeEach(() => {
      vi.mocked(auth).mockReset();
    });

    afterEach(async () => {
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
      matchIds.length = 0;
    });

    it("lets a player write a pairing-mate's strokes, putts and Greenies", async () => {
      const f = await tournamentFixture();
      const marker = await playerFixture(f);
      const mate = await playerFixture(f);
      await pairingFixture(f.tournament.id, [marker.round.id, mate.round.id]);
      signInAs(marker.user.id);

      await expectWritesAllowed(mate.round.id, { strokes: 5, feet: 12 });
    });

    it("lets a pairing-mate delete a Greenie they entered", async () => {
      const f = await tournamentFixture();
      const marker = await playerFixture(f);
      const mate = await playerFixture(f);
      await pairingFixture(f.tournament.id, [marker.round.id, mate.round.id]);
      signInAs(marker.user.id);
      await roundActions.upsertRoundGreenie({
        roundId: mate.round.id,
        hole: PAR_THREE_HOLE,
        feet: 12,
        inches: 3,
      });

      expect(
        await roundActions.deleteRoundGreenie({
          roundId: mate.round.id,
          hole: PAR_THREE_HOLE,
        }),
      ).toMatchObject({ ok: true });
      expect(await greenieOf(mate.round.id, PAR_THREE_HOLE)).toBeUndefined();
    });

    it("rejects a Tournament player in a different Pairing", async () => {
      const f = await tournamentFixture();
      const outsider = await playerFixture(f);
      const target = await playerFixture(f);
      await pairingFixture(f.tournament.id, [outsider.round.id]);
      await pairingFixture(f.tournament.id, [target.round.id]);
      signInAs(outsider.user.id);

      await expectWritesRejected(target.round.id);
    });

    it("rejects a Tournament player in no Pairing", async () => {
      const f = await tournamentFixture();
      const ungrouped = await playerFixture(f);
      const target = await playerFixture(f);
      await pairingFixture(f.tournament.id, [target.round.id]);
      signInAs(ungrouped.user.id);

      await expectWritesRejected(target.round.id);
    });

    it("rejects a peer write in a Tournament with no Pairings at all", async () => {
      const f = await tournamentFixture();
      const peer = await playerFixture(f);
      const target = await playerFixture(f);
      signInAs(peer.user.id);

      await expectWritesRejected(target.round.id);
    });

    it("lets a Round's owner write their own Round when they are in no Pairing", async () => {
      const f = await tournamentFixture();
      const player = await playerFixture(f);
      signInAs(player.user.id);

      await expectWritesAllowed(player.round.id, { strokes: 4, feet: 6 });
    });

    it("lets an admin write any Round", async () => {
      const f = await tournamentFixture();
      const target = await playerFixture(f);
      await pairingFixture(f.tournament.id, [target.round.id]);
      const admin = await userFixture({ isAdmin: true });
      signInAs(admin.id);

      await expectWritesAllowed(target.round.id, { strokes: 7, feet: 20 });
    });

    it("leaves Match peer scoring unaffected", async () => {
      const { players } = await matchFixture(2);
      const [marker, opponent] = players;
      signInAs(marker.user.id);

      expect(
        await roundActions.upsertRoundScore({
          roundId: opponent.round.id,
          hole: PAR_FOUR_HOLE,
          strokes: 5,
          putts: 2,
        }),
      ).toMatchObject({ ok: true });
      expect(await scoreOf(opponent.round.id, PAR_FOUR_HOLE)).toMatchObject({
        strokes: 5,
      });
    });

    it("still rejects a non-member of a Match", async () => {
      const { players } = await matchFixture(2);
      const stranger = await userFixture();
      signInAs(stranger.id);

      expect(
        await roundActions.upsertRoundScore({
          roundId: players[1].round.id,
          hole: PAR_FOUR_HOLE,
          strokes: 5,
          putts: 2,
        }),
      ).toMatchObject({ ok: false });
      expect(await scoreOf(players[1].round.id, PAR_FOUR_HOLE)).toBeUndefined();
    });
  });
}
