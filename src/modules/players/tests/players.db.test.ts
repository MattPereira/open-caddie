import { describe, expect, it } from "vitest";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { createRoundFixtures } from "@/lib/rounds/test-fixtures";
import * as players from "../index";

describe("Players read", () => {
  const fixtures = createRoundFixtures(db, schema);

  type Player = Awaited<ReturnType<typeof fixtures.player>>;

  async function round(player: Player) {
    const t = await fixtures.tournament();
    const [created] = await db
      .insert(schema.rounds)
      .values({
        tournamentId: t.tournament.id,
        playerId: player.id,
        courseId: t.course.id,
        teeId: t.tee.id,
        date: t.tournament.date,
      })
      .returning();
    return created;
  }

  async function card(
    roundId: number,
    { strokes, putts, holes = 18 }: { strokes: number; putts: number | null; holes?: number },
  ) {
    await db.insert(schema.roundScores).values(
      Array.from({ length: holes }, (_, index) => ({
        roundId,
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
      expect(await players.requirePlatformAdmin(admin.id, "Nope.")).toEqual({ ok: true });
      expect(await players.requirePlatformAdmin(player.id, "Nope.")).toEqual({
        ok: false,
        error: "Nope.",
      });
    });
  });

  describe("getAllPlayers", () => {
    it("counts each Player's Rounds and Greenies, zero when none", async () => {
      const active = await fixtures.player();
      const idle = await fixtures.player();
      const first = await round(active);
      await round(active);
      await db.insert(schema.roundScores).values({ roundId: first.id, hole: 3, strokes: 3, putts: 1 });
      await db.insert(schema.greenies).values({ roundId: first.id, hole: 3, feet: 4, inches: 0 });

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
      await db.insert(schema.greenies).values({ roundId: complete.id, hole: 3, feet: 4, inches: 0 });

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
