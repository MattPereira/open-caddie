import { afterEach, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  describe.skip("Round reads", () => {
    it("requires TEST_DATABASE_URL", () => {});
  });
} else {
  describe("Round reads", async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.DATABASE_DRIVER = "node-postgres";
    const [{ db }, schema, reads, { createRoundFixtures }] = await Promise.all([
      import("@/db"),
      import("@/db/schema"),
      import("./reads"),
      import("./test-fixtures"),
    ]);
    const { eq } = await import("drizzle-orm");
    const fixtures = createRoundFixtures(db, schema);

    type Tournament = Awaited<ReturnType<typeof fixtures.tournament>>;

    afterEach(async () => {
      await fixtures.cleanup();
    });

    // Fixture tees are rated 72, so with their slope a Round's Score
    // Differential scales back to (strokes - 72) as a Course Handicap.
    async function card(roundId: number, totalStrokes: number) {
      await db.insert(schema.roundScores).values(
        Array.from({ length: 18 }, (_, index) => ({
          roundId,
          hole: index + 1,
          strokes: index === 17 ? totalStrokes - 68 : 4,
          putts: 2,
        })),
      );
    }

    async function casualRound() {
      const { course, tee } = await fixtures.course();
      const player = await fixtures.user();
      const [round] = await db
        .insert(schema.rounds)
        .values({
          playerId: player.id,
          courseId: course.id,
          teeId: tee.id,
          date: new Date("2026-01-01T00:00:00.000Z"),
        })
        .returning();
      return round;
    }

    // A complete Round for `userId` in another Tournament of the same Club.
    async function priorRound(
      t: Tournament,
      userId: string,
      date: string,
      totalStrokes: number,
    ) {
      const [other] = await db
        .insert(schema.tournaments)
        .values({
          seasonId: t.tournament.seasonId,
          date: new Date(`${date}T00:00:00.000Z`),
          courseId: t.course.id,
          teeId: t.tee.id,
        })
        .returning();
      const [round] = await db
        .insert(schema.rounds)
        .values({
          tournamentId: other.id,
          playerId: userId,
          courseId: t.course.id,
          teeId: t.tee.id,
          date: other.date,
        })
        .returning();
      await card(round.id, totalStrokes);
      return round;
    }

    describe("kind", () => {
      it("tags Tournament Rounds, without a Player Index Override", async () => {
        const t = await fixtures.tournament();
        const { round } = await fixtures.tournamentPlayer(t);

        const { rounds } = await reads.readTournamentRounds(t.tournament.id);

        expect(rounds).toHaveLength(1);
        expect(rounds[0]).toMatchObject({
          id: round.id,
          kind: "tournament",
          tournamentId: t.tournament.id,
        });
        expect(rounds[0]).not.toHaveProperty("playerIndexOverride");
      });

      it("tags Match Rounds, with their Player Index Override", async () => {
        const { match, players } = await fixtures.match(1);
        await db
          .update(schema.rounds)
          .set({ playerIndexOverride: "8.4" })
          .where(eq(schema.rounds.id, players[0].round.id));

        const { rounds } = await reads.readMatchRounds(match.id);

        expect(rounds).toMatchObject([
          { kind: "match", matchId: match.id, playerIndexOverride: 8.4 },
        ]);
      });

      it("tags a single Round by its event", async () => {
        const t = await fixtures.tournament();
        const { round: tournamentRound } = await fixtures.tournamentPlayer(t);
        const { players } = await fixtures.match(1);
        const casual = await casualRound();

        const [tournament, match, single] = await Promise.all([
          reads.readRound(tournamentRound.id),
          reads.readRound(players[0].round.id),
          reads.readRound(casual.id),
        ]);

        expect(tournament?.rounds[0].kind).toBe("tournament");
        expect(match?.rounds[0]).toMatchObject({
          kind: "match",
          playerIndexOverride: null,
        });
        expect(single?.rounds[0].kind).toBe("casual");
        expect(single?.rounds[0]).not.toHaveProperty("playerIndexOverride");
        expect(await reads.readRound(-1)).toBeNull();
      });
    });

    describe("Tournament Playing Handicap", () => {
      it("plays scratch with fewer than 2 prior Rounds", async () => {
        const t = await fixtures.tournament();
        const { user, round } = await fixtures.tournamentPlayer(t);
        await priorRound(t, user.id, "2025-06-01", 90);
        await card(round.id, 80);

        const { rounds } = await reads.readTournamentRounds(t.tournament.id);

        expect(rounds[0]).toMatchObject({ playingHandicap: 0, netStrokes: 80 });
      });

      it("uses the best 2 of the last 4 prior Rounds", async () => {
        const t = await fixtures.tournament();
        const { user, round } = await fixtures.tournamentPlayer(t);
        // The oldest, and best, Round falls outside the last 4.
        await priorRound(t, user.id, "2025-01-01", 70);
        await priorRound(t, user.id, "2025-02-01", 82);
        await priorRound(t, user.id, "2025-03-01", 78);
        await priorRound(t, user.id, "2025-04-01", 90);
        await priorRound(t, user.id, "2025-05-01", 76);
        await card(round.id, 80);

        const [only] = (await reads.readTournamentRounds(t.tournament.id)).rounds;

        // Best two of 82, 78, 90, 76 are 76 and 78: (4 + 6) / 2.
        expect(only.playingHandicap).toBeCloseTo(5);
        expect(only.netStrokes).toBeCloseTo(75);
      });

      it("counts prior Rounds only from the same Club and earlier dates", async () => {
        const t = await fixtures.tournament();
        const { user } = await fixtures.tournamentPlayer(t);
        await priorRound(t, user.id, "2025-02-01", 80);
        await priorRound(t, user.id, "2025-03-01", 84);
        // Neither of these may count: one is after the event, one elsewhere.
        await priorRound(t, user.id, "2026-02-01", 72);
        const elsewhere = await fixtures.tournament();
        const [otherClubRound] = await db
          .insert(schema.rounds)
          .values({
            tournamentId: elsewhere.tournament.id,
            playerId: user.id,
            courseId: elsewhere.course.id,
            teeId: elsewhere.tee.id,
            date: new Date("2025-04-01T00:00:00.000Z"),
          })
          .returning();
        await card(otherClubRound.id, 72);

        const [only] = (await reads.readTournamentRounds(t.tournament.id)).rounds;

        expect(only.playingHandicap).toBeCloseTo(10);
      });

      it("gives each player of the field what they get read alone", async () => {
        const t = await fixtures.tournament();
        const a = await fixtures.tournamentPlayer(t);
        const b = await fixtures.tournamentPlayer(t);
        const c = await fixtures.tournamentPlayer(t);
        await priorRound(t, a.user.id, "2025-02-01", 76);
        await priorRound(t, a.user.id, "2025-03-01", 78);
        await priorRound(t, b.user.id, "2025-02-01", 90);
        await priorRound(t, b.user.id, "2025-03-01", 86);
        await priorRound(t, b.user.id, "2025-04-01", 94);
        await card(a.round.id, 80);
        await card(b.round.id, 95);

        const { rounds } = await reads.readTournamentRounds(t.tournament.id);
        const handicaps = Object.fromEntries(
          rounds.map((round) => [round.id, round.playingHandicap]),
        );

        expect(handicaps[a.round.id]).toBeCloseTo(5);
        expect(handicaps[b.round.id]).toBeCloseTo(16);
        expect(handicaps[c.round.id]).toBe(0);
        for (const { round } of [a, b, c]) {
          const alone = await reads.readRound(round.id);
          expect(alone?.rounds[0].playingHandicap).toBeCloseTo(
            handicaps[round.id],
          );
        }
      });
    });

    describe("Match Playing Handicap", () => {
      it("comes from the Player Index Override, or scratch without one", async () => {
        const { match, players } = await fixtures.match(2);
        const [withOverride, without] = players;
        await db
          .update(schema.rounds)
          .set({ playerIndexOverride: "11.3" })
          .where(eq(schema.rounds.id, withOverride.round.id));
        await card(withOverride.round.id, 90);
        await card(without.round.id, 90);

        const { rounds } = await reads.readMatchRounds(match.id);
        const byId = new Map(rounds.map((round) => [round.id, round]));

        // 11.3 on a slope 120 tee: 11.3 * 120 / 113 = 12.
        expect(byId.get(withOverride.round.id)?.playingHandicap).toBeCloseTo(12);
        expect(byId.get(withOverride.round.id)?.netStrokes).toBeCloseTo(78);
        expect(byId.get(without.round.id)).toMatchObject({
          playingHandicap: 0,
          netStrokes: 90,
        });
      });
    });

    it("applies no Playing Handicap to a casual Round", async () => {
      const round = await casualRound();
      await card(round.id, 85);

      const read = await reads.readRound(round.id);

      expect(read?.rounds[0]).toMatchObject({
        totalStrokes: 85,
        isComplete: true,
        playingHandicap: null,
        netStrokes: null,
      });
    });

    it("sorts by net, then gross, then name, with no net strokes last", async () => {
      const t = await fixtures.tournament();
      const players = [];
      for (const lastName of ["Incomplete", "Bravo", "Alpha", "Handicap", "Low"]) {
        const player = await fixtures.tournamentPlayer(t);
        await db
          .update(schema.users)
          .set({ lastName })
          .where(eq(schema.users.id, player.user.id));
        players.push(player);
      }
      const [incomplete, bravo, alpha, handicap, low] = players;
      await db
        .insert(schema.roundScores)
        .values({ roundId: incomplete.round.id, hole: 1, strokes: 3 });
      await card(bravo.round.id, 77);
      await card(alpha.round.id, 77);
      // Net 75 off gross 80 ranks behind a scratch 75.
      await priorRound(t, handicap.user.id, "2025-02-01", 76);
      await priorRound(t, handicap.user.id, "2025-03-01", 78);
      await card(handicap.round.id, 80);
      await card(low.round.id, 75);

      const { rounds } = await reads.readTournamentRounds(t.tournament.id);

      expect(rounds.map((round) => round.lastName)).toEqual([
        "Low",
        "Handicap",
        "Alpha",
        "Bravo",
        "Incomplete",
      ]);
    });

    it("carries each Round's per-hole scores and Greenies", async () => {
      const { match, players } = await fixtures.match(2);
      const mate = players[1];
      await db.insert(schema.roundScores).values([
        { roundId: mate.round.id, hole: 1, strokes: 5, putts: 2 },
        { roundId: mate.round.id, hole: 3, strokes: 3, putts: 1 },
      ]);
      await db
        .insert(schema.greenies)
        .values({ roundId: mate.round.id, hole: 3, feet: 12, inches: 6 });

      const { rounds } = await reads.readMatchRounds(match.id);

      expect(rounds.find((round) => round.id === mate.round.id)).toMatchObject({
        playerId: mate.user.id,
        scores: [
          { hole: 1, par: 4, strokes: 5, putts: 2 },
          { hole: 3, par: 3, strokes: 3, putts: 1 },
        ],
        greenies: [{ hole: 3, feet: 12, inches: 6 }],
      });
    });

    describe("course data", () => {
      async function yardage(teeId: number, firstHoleYards: number) {
        await db.insert(schema.teeYardages).values(
          Array.from({ length: 18 }, (_, index) => ({
            teeId,
            hole: index + 1,
            yards: firstHoleYards + index,
          })),
        );
      }

      it("returns holes with par and handicap, and tees with total yards", async () => {
        const t = await fixtures.tournament();
        const white = await fixtures.tee(t.course.id);
        await yardage(t.tee.id, 400);

        const { course } = await reads.readTournamentRounds(t.tournament.id);

        expect(course.holes).toHaveLength(18);
        expect(course.holes[0]).toEqual({ hole: 1, par: 4, handicap: 1 });
        expect(course.holes[2]).toEqual({ hole: 3, par: 3, handicap: 3 });
        // 400 + 401 + ... + 417.
        expect(course.tees).toMatchObject([
          { id: t.tee.id, name: "Blue", totalYards: 7353 },
          { id: white.id, name: "White", totalYards: null },
        ]);
      });

      it("gives each Round the yards of its own tee", async () => {
        const t = await fixtures.tournament();
        const white = await fixtures.tee(t.course.id);
        await yardage(t.tee.id, 400);
        await yardage(white.id, 300);
        const blue = await fixtures.tournamentPlayer(t);
        const onWhite = await fixtures.tournamentPlayer(t);
        await db
          .update(schema.rounds)
          .set({ teeId: white.id })
          .where(eq(schema.rounds.id, onWhite.round.id));

        const { rounds } = await reads.readTournamentRounds(t.tournament.id);
        const byId = new Map(rounds.map((round) => [round.id, round]));

        expect(byId.get(blue.round.id)?.yards).toHaveLength(18);
        expect(byId.get(blue.round.id)?.yards[0]).toEqual({ hole: 1, yards: 400 });
        expect(byId.get(onWhite.round.id)?.yards).toHaveLength(18);
        expect(byId.get(onWhite.round.id)?.yards[17]).toEqual({
          hole: 18,
          yards: 317,
        });
      });

      it("still has the course for an event with no Rounds", async () => {
        const { match, players } = await fixtures.match(1);
        await db
          .delete(schema.rounds)
          .where(eq(schema.rounds.id, players[0].round.id));

        const read = await reads.readMatchRounds(match.id);

        expect(read.rounds).toEqual([]);
        expect(read.course.holes).toHaveLength(18);
        expect(read.course.tees).toHaveLength(1);
      });
    });

    describe("handicap details", () => {
      it("marks which prior Rounds were used for the Player Index", async () => {
        const t = await fixtures.tournament();
        const { user, round } = await fixtures.tournamentPlayer(t);
        const used76 = await priorRound(t, user.id, "2025-02-01", 76);
        const unused90 = await priorRound(t, user.id, "2025-03-01", 90);
        const used78 = await priorRound(t, user.id, "2025-04-01", 78);

        const read = await reads.readRound(round.id, true);
        const details = read?.handicapDetails;

        expect(
          details?.priorRounds.map((prior) => [prior.id, prior.usedForPlayerIndex]),
        ).toEqual([
          [used78.id, true],
          [unused90.id, false],
          [used76.id, true],
        ]);
        expect(details?.priorRounds[0]).toMatchObject({
          courseHandle: t.course.handle,
          totalStrokes: 78,
        });
        // Differentials (113 / 120) * 4 and (113 / 120) * 6, averaged.
        expect(details?.playerIndex).toBeCloseTo((113 / 120) * 5);
        expect(details?.courseHandicap).toBeCloseTo(5);
      });

      it("has none for Match and casual Rounds, or when not asked for", async () => {
        const t = await fixtures.tournament();
        const { round } = await fixtures.tournamentPlayer(t);
        const { players } = await fixtures.match(1);
        const casual = await casualRound();

        const [match, single, unasked] = await Promise.all([
          reads.readRound(players[0].round.id, true),
          reads.readRound(casual.id, true),
          reads.readRound(round.id),
        ]);

        expect(match?.handicapDetails).toBeNull();
        expect(single?.handicapDetails).toBeNull();
        expect(unasked?.handicapDetails).toBeNull();
      });
    });
  });
}
