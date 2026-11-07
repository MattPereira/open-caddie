import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted so the test and the modules share one pair of mocks: the factory
// can run more than once when the dynamic imports below race.
const { revalidatePath, updateTag } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath, updateTag }));

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  describe.skip("Round scorecard writes", () => {
    it("requires TEST_DATABASE_URL", () => {});
  });
} else {
  describe("Round scorecard writes", async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.DATABASE_DRIVER = "node-postgres";
    const [
      { db },
      schema,
      { recordScorecardChanges, changeRoundSettings },
      { createRoundFixtures, PAR_THREE_HOLES },
    ] = await Promise.all([
      import("@/db"),
      import("@/db/schema"),
      import("./scorecard-writes"),
      import("./test-fixtures"),
    ]);
    const { readScorecardsByRounds } = await import("./scorecards");
    const { eq } = await import("drizzle-orm");
    const fixtures = createRoundFixtures(db, schema);

    const PAR_THREE = PAR_THREE_HOLES[0];
    const PAR_FOUR = 1;

    function scorecardOf(roundId: number) {
      return readScorecardsByRounds(eq(schema.rounds.id, roundId));
    }

    async function holeOf(roundId: number, hole: number) {
      const scorecard = await scorecardOf(roundId);
      const score = scorecard.scores.find((s) => s.hole === hole);
      return { strokes: score?.strokes ?? null, putts: score?.putts ?? null };
    }

    async function greenieOf(roundId: number, hole: number) {
      const scorecard = await scorecardOf(roundId);
      const greenie = scorecard.greenies.find((g) => g.hole === hole);
      return greenie ? { feet: greenie.feet, inches: greenie.inches } : null;
    }

    function sortedPaths(calls: string[][]) {
      return calls.map((call) => call.join(" ")).sort();
    }

    function invalidatedPaths() {
      return sortedPaths(
        vi.mocked(revalidatePath).mock.calls as unknown as string[][],
      );
    }

    async function settingsOf(roundId: number) {
      const [round] = await db
        .select({
          teeId: schema.rounds.teeId,
          playerIndexOverride: schema.rounds.playerIndexOverride,
        })
        .from(schema.rounds)
        .where(eq(schema.rounds.id, roundId));
      return round;
    }

    const CANNOT_MANAGE = "You can't change this Round's settings.";

    beforeEach(() => {
      vi.mocked(revalidatePath).mockClear();
      vi.mocked(updateTag).mockClear();
    });

    afterEach(async () => {
      await fixtures.cleanup();
    });

    it("keeps a field that's left out and clears one that's explicitly null", async () => {
      const t = await fixtures.tournament();
      const player = await fixtures.tournamentPlayer(t);
      const roundId = player.round.id;
      await recordScorecardChanges(player.user.id, {
        scores: [{ roundId, hole: PAR_FOUR, strokes: 5, putts: 2 }],
      });

      expect(
        await recordScorecardChanges(player.user.id, {
          scores: [{ roundId, hole: PAR_FOUR, strokes: 4 }],
        }),
      ).toEqual({ ok: true });
      expect(await holeOf(roundId, PAR_FOUR)).toEqual({ strokes: 4, putts: 2 });

      await recordScorecardChanges(player.user.id, {
        scores: [{ roundId, hole: PAR_FOUR, putts: null }],
      });
      expect(await holeOf(roundId, PAR_FOUR)).toEqual({
        strokes: 4,
        putts: null,
      });
    });

    it("sets and clears a Greenie without touching the hole's score", async () => {
      const t = await fixtures.tournament();
      const player = await fixtures.tournamentPlayer(t);
      const roundId = player.round.id;
      await recordScorecardChanges(player.user.id, {
        scores: [{ roundId, hole: PAR_THREE, strokes: 3, putts: 1 }],
      });

      await recordScorecardChanges(player.user.id, {
        greenies: [
          { roundId, hole: PAR_THREE, distance: { feet: 12, inches: 4 } },
        ],
      });
      expect(await greenieOf(roundId, PAR_THREE)).toEqual({
        feet: 12,
        inches: 4,
      });

      await recordScorecardChanges(player.user.id, {
        greenies: [{ roundId, hole: PAR_THREE, distance: null }],
      });
      expect(await greenieOf(roundId, PAR_THREE)).toBeNull();
      expect(await holeOf(roundId, PAR_THREE)).toEqual({ strokes: 3, putts: 1 });
    });

    it("rejects a Greenie on a hole that isn't a par 3 and writes nothing", async () => {
      const t = await fixtures.tournament();
      const player = await fixtures.tournamentPlayer(t);
      const roundId = player.round.id;

      expect(
        await recordScorecardChanges(player.user.id, {
          scores: [{ roundId, hole: PAR_FOUR, strokes: 4 }],
          greenies: [
            { roundId, hole: PAR_FOUR, distance: { feet: 3, inches: 0 } },
          ],
        }),
      ).toMatchObject({
        ok: false,
        error: "Greenies can only be recorded on par 3 holes.",
      });
      expect(await holeOf(roundId, PAR_FOUR)).toEqual({
        strokes: null,
        putts: null,
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it.each([
      [{ strokes: 0 }, "Score is out of allowed range."],
      [{ putts: -1 }, "Score is out of allowed range."],
      [{ strokes: 4.5 }, "Score is out of allowed range."],
    ])("rejects out-of-range score %o", async (fields, error) => {
      const t = await fixtures.tournament();
      const player = await fixtures.tournamentPlayer(t);
      const roundId = player.round.id;

      expect(
        await recordScorecardChanges(player.user.id, {
          scores: [
            { roundId, hole: 2, strokes: 4 },
            { roundId, hole: PAR_FOUR, ...fields },
          ],
        }),
      ).toMatchObject({ ok: false, error });
      expect(await holeOf(roundId, 2)).toEqual({ strokes: null, putts: null });
    });

    it.each([
      [{ feet: -1, inches: 0 }],
      [{ feet: 3, inches: 12 }],
    ])("rejects out-of-range Greenie distance %o", async (distance) => {
      const t = await fixtures.tournament();
      const player = await fixtures.tournamentPlayer(t);
      const roundId = player.round.id;

      expect(
        await recordScorecardChanges(player.user.id, {
          greenies: [{ roundId, hole: PAR_THREE, distance }],
        }),
      ).toMatchObject({
        ok: false,
        error: "Greenie distance is out of allowed range.",
      });
      expect(await greenieOf(roundId, PAR_THREE)).toBeNull();
    });

    it("lets a Match creator who isn't playing record scores", async () => {
      const { creator, players } = await fixtures.match(2, {
        creatorPlays: false,
      });
      const roundId = players[0].round.id;

      expect(
        await recordScorecardChanges(creator.id, {
          scores: [{ roundId, hole: PAR_FOUR, strokes: 5, putts: 2 }],
        }),
      ).toEqual({ ok: true });
      expect(await holeOf(roundId, PAR_FOUR)).toEqual({ strokes: 5, putts: 2 });
    });

    it("reports not found to someone who can't score the Round", async () => {
      const t = await fixtures.tournament();
      const target = await fixtures.tournamentPlayer(t);
      const stranger = await fixtures.tournamentPlayer(t);

      expect(
        await recordScorecardChanges(stranger.user.id, {
          scores: [{ roundId: target.round.id, hole: PAR_FOUR, strokes: 5 }],
        }),
      ).toMatchObject({ ok: false, error: "Round not found." });
      expect(await holeOf(target.round.id, PAR_FOUR)).toEqual({
        strokes: null,
        putts: null,
      });
    });

    it("writes nothing in a multi-Round write when one Round isn't scoreable", async () => {
      const t = await fixtures.tournament();
      const marker = await fixtures.tournamentPlayer(t);
      const mate = await fixtures.tournamentPlayer(t);
      const outsider = await fixtures.tournamentPlayer(t);
      await fixtures.pairing(t.tournament.id, [marker.round.id, mate.round.id]);

      expect(
        await recordScorecardChanges(marker.user.id, {
          scores: [
            { roundId: marker.round.id, hole: PAR_FOUR, strokes: 4 },
            { roundId: mate.round.id, hole: PAR_FOUR, strokes: 5 },
            { roundId: outsider.round.id, hole: PAR_FOUR, strokes: 6 },
          ],
        }),
      ).toMatchObject({ ok: false, error: "Round not found." });
      for (const round of [marker.round, mate.round, outsider.round]) {
        expect(await holeOf(round.id, PAR_FOUR)).toEqual({
          strokes: null,
          putts: null,
        });
      }
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("invalidates the Round changed pages, including course records", async () => {
      const t = await fixtures.tournament();
      const player = await fixtures.tournamentPlayer(t);

      await recordScorecardChanges(player.user.id, {
        scores: [{ roundId: player.round.id, hole: PAR_FOUR, strokes: 4 }],
      });

      expect(invalidatedPaths()).toEqual(
        sortedPaths([
          ["/"],
          ["/records"],
          ["/clubs/[handle]", "page"],
          [`/players/${player.user.id}`],
          [`/rounds/${player.round.id}`],
          [`/tournaments/${t.tournament.id}`],
        ]),
      );
    });

    it("invalidates the union of every Round's pages in a multi-Round write", async () => {
      const { match, players } = await fixtures.match(2);
      const [a, b] = players;

      await recordScorecardChanges(a.user.id, {
        scores: [{ roundId: a.round.id, hole: PAR_FOUR, strokes: 4 }],
        greenies: [
          {
            roundId: b.round.id,
            hole: PAR_THREE,
            distance: { feet: 8, inches: 0 },
          },
        ],
      });

      expect(invalidatedPaths()).toEqual(
        sortedPaths([
          ["/"],
          ["/records"],
          ["/clubs/[handle]", "page"],
          [`/players/${a.user.id}`],
          [`/players/${b.user.id}`],
          [`/rounds/${a.round.id}`],
          [`/rounds/${b.round.id}`],
          [`/matches/${match.id}`],
        ]),
      );
    });
    describe("change Round settings", () => {
      it("keeps a Pairing mate's live score when the Round's player changes tees", async () => {
        const t = await fixtures.tournament();
        const player = await fixtures.tournamentPlayer(t);
        const mate = await fixtures.tournamentPlayer(t);
        await fixtures.pairing(t.tournament.id, [
          player.round.id,
          mate.round.id,
        ]);
        const white = await fixtures.tee(t.course.id);
        await recordScorecardChanges(player.user.id, {
          scores: [{ roundId: player.round.id, hole: 1, strokes: 5, putts: 2 }],
        });
        // Entered from the mate's phone after the player's page loaded.
        await recordScorecardChanges(mate.user.id, {
          scores: [{ roundId: player.round.id, hole: 2, strokes: 3, putts: 1 }],
          greenies: [
            {
              roundId: player.round.id,
              hole: PAR_THREE,
              distance: { feet: 9, inches: 2 },
            },
          ],
        });

        expect(
          await changeRoundSettings(player.user.id, player.round.id, {
            teeId: white.id,
          }),
        ).toEqual({ ok: true });

        expect((await settingsOf(player.round.id)).teeId).toBe(white.id);
        expect(await holeOf(player.round.id, 1)).toEqual({
          strokes: 5,
          putts: 2,
        });
        expect(await holeOf(player.round.id, 2)).toEqual({
          strokes: 3,
          putts: 1,
        });
        expect(await greenieOf(player.round.id, PAR_THREE)).toEqual({
          feet: 9,
          inches: 2,
        });
      });

      it("rejects a tee from another course", async () => {
        const t = await fixtures.tournament();
        const player = await fixtures.tournamentPlayer(t);
        const { tee: elsewhere } = await fixtures.course();

        expect(
          await changeRoundSettings(player.user.id, player.round.id, {
            teeId: elsewhere.id,
          }),
        ).toMatchObject({
          ok: false,
          error: "Selected tees do not belong to this course.",
        });
        expect((await settingsOf(player.round.id)).teeId).toBe(t.tee.id);
      });

      it("rejects a Player Index Override on a non-Match Round", async () => {
        const t = await fixtures.tournament();
        const player = await fixtures.tournamentPlayer(t);
        const white = await fixtures.tee(t.course.id);

        expect(
          await changeRoundSettings(player.user.id, player.round.id, {
            teeId: white.id,
            playerIndexOverride: 12.3,
          }),
        ).toMatchObject({
          ok: false,
          error: "A Player Index Override can only be set on a Match Round.",
        });
        expect(await settingsOf(player.round.id)).toEqual({
          teeId: t.tee.id,
          playerIndexOverride: null,
        });
      });

      it("sets and clears a Player Index Override on a Match Round", async () => {
        const { players } = await fixtures.match(2);
        const [a] = players;

        await changeRoundSettings(a.user.id, a.round.id, {
          playerIndexOverride: 12.3,
        });
        expect((await settingsOf(a.round.id)).playerIndexOverride).toBe("12.3");

        await changeRoundSettings(a.user.id, a.round.id, {
          playerIndexOverride: null,
        });
        expect((await settingsOf(a.round.id)).playerIndexOverride).toBeNull();
      });

      it("gives a Scorer who can't manage the Round a distinct error", async () => {
        const { players, match } = await fixtures.match(2);
        const [a, b] = players;
        const white = await fixtures.tee(match.courseId);

        expect(
          await changeRoundSettings(b.user.id, a.round.id, {
            teeId: white.id,
          }),
        ).toMatchObject({ ok: false, error: CANNOT_MANAGE });
        expect((await settingsOf(a.round.id)).teeId).not.toBe(white.id);
      });

      it("reports not found to someone who can't score the Round", async () => {
        const t = await fixtures.tournament();
        const player = await fixtures.tournamentPlayer(t);
        const stranger = await fixtures.tournamentPlayer(t);

        expect(
          await changeRoundSettings(stranger.user.id, player.round.id, {
            teeId: t.tee.id,
          }),
        ).toMatchObject({ ok: false, error: "Round not found." });
      });

      it("invalidates the Round changed pages but not the home events cache", async () => {
        const t = await fixtures.tournament();
        const player = await fixtures.tournamentPlayer(t);
        const white = await fixtures.tee(t.course.id);

        await changeRoundSettings(player.user.id, player.round.id, {
          teeId: white.id,
        });

        expect(invalidatedPaths()).toEqual(
          sortedPaths([
            ["/"],
            ["/records"],
            ["/clubs/[handle]", "page"],
            [`/players/${player.user.id}`],
            [`/rounds/${player.round.id}`],
            [`/tournaments/${t.tournament.id}`],
          ]),
        );
        expect(updateTag).not.toHaveBeenCalled();
      });
    });
  });
}
