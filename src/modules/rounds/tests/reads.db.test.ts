import { describe, expect, it } from "vitest";

import { createFixtures } from "@/test/fixtures";
import {
  getActiveRoundForPlayer,
  getClosestGreenies,
  getLowestRounds,
} from "../server";

describe("Round reads", () => {
  const fixtures = createFixtures();

  describe("active Round", () => {
    it("is the player's most recently created incomplete Round, with its Tournament's Season", async () => {
      const { course, tee } = await fixtures.course();
      const player = await fixtures.player();
      const casual = (date: string) =>
        fixtures.casualRound({
          playerId: player.id,
          courseHandle: course.handle,
          teeId: tee.id,
          date,
        });
      // Created first but dated after the Tournament: creation order wins.
      await casual("2026-03-01");
      const t = await fixtures.tournament();
      const { round: tournamentRound } = await fixtures.tournamentPlayer(
        t,
        player,
      );
      await fixtures.completeCard((await casual("2026-02-01")).id, 80);
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
      const round = await fixtures.casualRound();

      expect(await getActiveRoundForPlayer(round.playerId)).toMatchObject({
        roundId: round.id,
        tournamentId: null,
        tournamentSeason: null,
        isComplete: false,
      });
    });

    it("is undefined when every Round of the player's is complete", async () => {
      const round = await fixtures.casualRound();
      await fixtures.completeCard(round.id, 80);

      expect(await getActiveRoundForPlayer(round.playerId)).toBeUndefined();
    });
  });

  describe("lowest Rounds", () => {
    it("lists complete Rounds lowest first, the later of a tie first, up to the limit", async () => {
      const t = await fixtures.tournament();
      const { player } = await fixtures.tournamentPlayer(t);
      const low = await fixtures.priorRound(t, player, "2025-01-01", 70);
      const tieEarlier = await fixtures.priorRound(t, player, "2025-02-01", 75);
      const tieLater = await fixtures.priorRound(t, player, "2025-03-01", 75);
      await fixtures.priorRound(t, player, "2025-04-01", 90);
      // The player's Round in `t` itself has no scores, so it isn't complete.

      const lowest = await getLowestRounds(3);

      expect(
        lowest.map((round) => [round.roundId, round.totalStrokes]),
      ).toEqual([
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
      const casual = await fixtures.casualRound();
      await fixtures.completeCard(tournamentRound.id, 72);
      await fixtures.completeCard(casual.id, 72);
      await fixtures.greenie(tournamentRound.id, 3, { feet: 4, inches: 6 });
      await fixtures.greenie(tournamentRound.id, 7, { feet: 12, inches: 0 });
      await fixtures.greenie(casual.id, 3, { feet: 4, inches: 2 });

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
