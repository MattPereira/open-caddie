import { describe, expect, it } from "vitest";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { createRoundFixtures } from "@/test/fixtures/rounds";
import {
  getActiveRoundForPlayer,
  getClosestGreenies,
  getLowestRounds,
} from "../index";

describe("Round reads", () => {
  const fixtures = createRoundFixtures(db, schema);

  type Tournament = Awaited<ReturnType<typeof fixtures.tournament>>;

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
    const player = await fixtures.player();
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

  // A complete Round for `playerId` in another Tournament of the same Club.
  async function priorRound(
    t: Tournament,
    playerId: string,
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
        playerId: playerId,
        courseId: t.course.id,
        teeId: t.tee.id,
        date: other.date,
      })
      .returning();
    await card(round.id, totalStrokes);
    return round;
  }

  describe("active Round", () => {
    it("is the player's most recently created incomplete Round, with its Tournament's Season", async () => {
      const { course, tee } = await fixtures.course();
      const player = await fixtures.player();
      const casual = (date: string) =>
        db
          .insert(schema.rounds)
          .values({
            playerId: player.id,
            courseId: course.id,
            teeId: tee.id,
            date: new Date(`${date}T00:00:00.000Z`),
          })
          .returning()
          .then(([round]) => round);
      // Created first but dated after the Tournament: creation order wins.
      await casual("2026-03-01");
      const t = await fixtures.tournament();
      const [tournamentRound] = await db
        .insert(schema.rounds)
        .values({
          tournamentId: t.tournament.id,
          playerId: player.id,
          courseId: t.course.id,
          teeId: t.tee.id,
          date: t.tournament.date,
        })
        .returning();
      await card((await casual("2026-02-01")).id, 80);
      await fixtures.tournamentPlayer(t);

      expect(await getActiveRoundForPlayer(player.id)).toMatchObject({
        roundId: tournamentRound.id,
        tournamentId: t.tournament.id,
        tournamentSeason: 1,
        courseHandle: t.course.handle,
        isComplete: false,
      });
    });

    it("can be a casual Round, with no Tournament or Season", async () => {
      const round = await casualRound();

      expect(await getActiveRoundForPlayer(round.playerId)).toMatchObject({
        roundId: round.id,
        tournamentId: null,
        tournamentSeason: null,
        isComplete: false,
      });
    });

    it("is undefined when every Round of the player's is complete", async () => {
      const round = await casualRound();
      await card(round.id, 80);

      expect(await getActiveRoundForPlayer(round.playerId)).toBeUndefined();
    });
  });

  describe("lowest Rounds", () => {
    it("lists complete Rounds lowest first, the later of a tie first, up to the limit", async () => {
      const t = await fixtures.tournament();
      const { player } = await fixtures.tournamentPlayer(t);
      const low = await priorRound(t, player.id, "2025-01-01", 70);
      const tieEarlier = await priorRound(t, player.id, "2025-02-01", 75);
      const tieLater = await priorRound(t, player.id, "2025-03-01", 75);
      await priorRound(t, player.id, "2025-04-01", 90);
      // The player's Round in `t` itself has no scores, so it isn't complete.

      const lowest = await getLowestRounds(3);

      expect(lowest.map((round) => [round.roundId, round.totalStrokes])).toEqual([
        [low.id, 70],
        [tieLater.id, 75],
        [tieEarlier.id, 75],
      ]);
      expect(lowest[0]).toMatchObject({
        courseName: t.course.name,
        lastName: player.lastName,
      });
    });
  });

  describe("closest Greenies", () => {
    it("lists Greenies closest first up to the limit, with the Club and Season of Tournament ones", async () => {
      const t = await fixtures.tournament();
      const { round: tournamentRound } = await fixtures.tournamentPlayer(t);
      const casual = await casualRound();
      await card(tournamentRound.id, 72);
      await card(casual.id, 72);
      await db.insert(schema.greenies).values([
        { roundId: tournamentRound.id, hole: 3, feet: 4, inches: 6 },
        { roundId: tournamentRound.id, hole: 7, feet: 12, inches: 0 },
        { roundId: casual.id, hole: 3, feet: 4, inches: 2 },
      ]);

      const closest = await getClosestGreenies(2);

      expect(closest).toEqual([
        expect.objectContaining({
          roundId: casual.id,
          hole: 3,
          feet: 4,
          inches: 2,
          clubName: null,
          season: null,
        }),
        expect.objectContaining({
          roundId: tournamentRound.id,
          hole: 3,
          feet: 4,
          inches: 6,
          courseHandle: t.course.handle,
          season: 1,
        }),
      ]);
      expect(closest[1].clubName).toMatch(/^Club /);
    });
  });
});
