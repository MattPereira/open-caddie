import { describe, expect, it } from "vitest";

import { createFixtures } from "@/test/fixtures";
import * as players from "../server";

describe("Player reads", () => {
  const fixtures = createFixtures();

  type Player = Awaited<ReturnType<typeof fixtures.player>>;

  async function round(player: Player) {
    const t = await fixtures.tournament();
    return (await fixtures.tournamentPlayer(t, player)).round;
  }

  async function card(
    roundId: number,
    {
      strokes,
      putts,
      holes = 18,
    }: { strokes: number; putts: number | null; holes?: number },
  ) {
    await fixtures.scores(
      roundId,
      Array.from({ length: holes }, (_, index) => ({
        hole: index + 1,
        strokes,
        putts: index === 17 ? putts : (putts ?? 2),
      })),
    );
  }

  describe("Platform Admin", () => {
    it("is true for a Platform Admin and false for anyone else", async () => {
      const admin = await fixtures.player({ isAdmin: true });
      const player = await fixtures.player();
      expect(await players.isPlatformAdmin(admin.id)).toBe(true);
      expect(await players.isPlatformAdmin(player.id)).toBe(false);
      expect(await players.isPlatformAdmin(crypto.randomUUID())).toBe(false);
    });

    it("refuses with the caller's error unless a Platform Admin", async () => {
      const admin = await fixtures.player({ isAdmin: true });
      const player = await fixtures.player();
      expect(await players.requirePlatformAdmin(admin.id, "Nope.")).toEqual({
        ok: true,
      });
      expect(await players.requirePlatformAdmin(player.id, "Nope.")).toEqual({
        ok: false,
        error: "Nope.",
      });
    });
  });

  describe("hasPlayerWithEmail", () => {
    it("finds a Player by stored email", async () => {
      const player = await fixtures.player();
      expect(await players.hasPlayerWithEmail(player.email ?? "")).toBe(true);
    });

    it("is false for an unknown email", async () => {
      expect(
        await players.hasPlayerWithEmail(`nobody-${crypto.randomUUID()}@x.com`),
      ).toBe(false);
    });
  });

  describe("getAllPlayers", () => {
    it("counts each Player's Rounds and Greenies, zero when none", async () => {
      const active = await fixtures.player();
      const idle = await fixtures.player();
      const first = await round(active);
      await round(active);
      await fixtures.scores(first.id, [{ hole: 3, strokes: 3, putts: 1 }]);
      await fixtures.greenie(first.id, 3, { feet: 4, inches: 0 });

      const all = await players.getAllPlayers();

      expect(all.find((p) => p.id === active.id)).toMatchObject({
        roundsCount: 2,
        greeniesCount: 1,
      });
      expect(all.find((p) => p.id === idle.id)).toMatchObject({
        roundsCount: 0,
        greeniesCount: 0,
      });
    });
  });

  describe("getPlayerStatsById", () => {
    it("averages strokes over Complete Rounds and putts over Rounds with all 18 putts", async () => {
      const player = await fixtures.player();
      const complete = await round(player);
      await card(complete.id, { strokes: 4, putts: 2 }); // 72 strokes, 36 putts
      const missingPutt = await round(player);
      await card(missingPutt.id, { strokes: 5, putts: null }); // 90 strokes, 17 putts recorded
      const partial = await round(player);
      await card(partial.id, { strokes: 3, putts: 1, holes: 9 });
      await fixtures.greenie(complete.id, 3, { feet: 4, inches: 0 });

      expect(await players.getPlayerStatsById(player.id)).toEqual({
        roundsCount: 3,
        averageStrokes: 81,
        averagePutts: 36,
        averageGreeniesPerRound: 1 / 3,
      });
    });

    it("has empty averages with no Rounds", async () => {
      const player = await fixtures.player();
      expect(await players.getPlayerStatsById(player.id)).toEqual({
        roundsCount: 0,
        averageStrokes: null,
        averagePutts: null,
        averageGreeniesPerRound: null,
      });
    });
  });
});
