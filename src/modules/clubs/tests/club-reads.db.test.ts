import { describe, expect, it } from "vitest";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { createRoundFixtures, PAR_THREE_HOLES } from "@/lib/rounds/test-fixtures";
import * as clubs from "../index";
import type { PointRules } from "../point-rules";

const POINT_RULES: PointRules = {
  participation: 5,
  pars: 1,
  birdies: 2,
  eagles: 3,
  aces: 10,
  strokes: { positions: [10, 5] },
  putts: { positions: [4] },
  greenies: { tiers: [{ maxFt: null, pts: 1 }] },
};

describe("Club reads", () => {
  const fixtures = createRoundFixtures(db, schema);

  async function club({ seasons = [] as number[] } = {}) {
    const suffix = crypto.randomUUID();
    const [created] = await db
      .insert(schema.clubs)
      .values({ handle: `club-${suffix}`, name: `Club ${suffix}`, pointRules: POINT_RULES })
      .returning();
    // Inserted out of order so the Current Season comes from the number, not insertion.
    const seasonIds: Record<number, number> = {};
    for (const number of [...seasons].reverse()) {
      const [season] = await db
        .insert(schema.seasons)
        .values({ clubId: created.id, number })
        .returning();
      seasonIds[number] = season.id;
    }
    return { club: created, seasonIds };
  }

  async function join(clubId: number, playerId: string) {
    await db.insert(schema.clubMembers).values({ clubId, playerId });
  }

  async function round(playerId: string, { greenies = 0 } = {}) {
    const { course, tee } = await fixtures.course();
    const [created] = await db
      .insert(schema.rounds)
      .values({
        playerId,
        courseId: course.id,
        teeId: tee.id,
        date: new Date("2026-01-01T00:00:00.000Z"),
      })
      .returning();
    const holes = PAR_THREE_HOLES.slice(0, greenies);
    if (holes.length > 0) {
      await db
        .insert(schema.roundScores)
        .values(holes.map((hole) => ({ roundId: created.id, hole, strokes: 3, putts: 1 })));
      await db
        .insert(schema.greenies)
        .values(holes.map((hole) => ({ roundId: created.id, hole, feet: 5, inches: 0 })));
    }
  }

  async function tournament(seasonId: number) {
    const { course, tee } = await fixtures.course();
    await db.insert(schema.tournaments).values({
      seasonId,
      courseId: course.id,
      teeId: tee.id,
      date: new Date("2026-01-01T00:00:00.000Z"),
    });
  }

  describe("getAllClubsWithSeasons", () => {
    it("makes the highest-numbered Season the Current Season", async () => {
      const { club: created, seasonIds } = await club({ seasons: [1, 2, 3] });
      const row = (await clubs.getAllClubsWithSeasons()).find((c) => c.id === created.id);
      expect(row?.seasons.map((s) => s.number)).toEqual([1, 2, 3]);
      expect(row?.currentSeasonId).toBe(seasonIds[3]);
    });

    it("has no Current Season when the Club has no Seasons", async () => {
      const { club: created } = await club();
      const row = (await clubs.getAllClubsWithSeasons()).find((c) => c.id === created.id);
      expect(row).toMatchObject({ seasons: [], currentSeasonId: null });
    });
  });

  describe("getAllClubsFull", () => {
    it("counts a Club's Players and Tournaments", async () => {
      const { club: created, seasonIds } = await club({ seasons: [1, 2] });
      await join(created.id, (await fixtures.player()).id);
      await join(created.id, (await fixtures.player()).id);
      await tournament(seasonIds[1]);
      await tournament(seasonIds[2]);
      await tournament(seasonIds[2]);
      const row = (await clubs.getAllClubsFull()).find((c) => c.id === created.id);
      expect(row).toEqual({
        id: created.id,
        handle: created.handle,
        name: created.name,
        logo: null,
        pointRules: POINT_RULES,
        playersCount: 2,
        tournamentsCount: 3,
      });
    });

    it("counts zero for a Club with no Players or Tournaments", async () => {
      const { club: created } = await club();
      const row = (await clubs.getAllClubsFull()).find((c) => c.id === created.id);
      expect(row).toMatchObject({ playersCount: 0, tournamentsCount: 0 });
    });
  });

  describe("getClubByHandle", () => {
    it("returns the Club's details", async () => {
      const { club: created } = await club();
      expect(await clubs.getClubByHandle(created.handle)).toEqual({
        id: created.id,
        handle: created.handle,
        name: created.name,
        logo: null,
        pointRules: POINT_RULES,
      });
    });

    it("returns null for an unknown handle", async () => {
      expect(await clubs.getClubByHandle(`missing-${crypto.randomUUID()}`)).toBeNull();
    });
  });

  describe("getClubPlayersByHandle", () => {
    it("returns the Club's Players with Round and Greenie counts", async () => {
      const { club: created } = await club();
      const { club: other } = await club();
      const regular = await fixtures.player();
      const newcomer = await fixtures.player();
      const outsider = await fixtures.player();
      await join(created.id, regular.id);
      await join(created.id, newcomer.id);
      await join(other.id, outsider.id);
      await round(regular.id, { greenies: 2 });
      await round(regular.id);

      const players = await clubs.getClubPlayersByHandle(created.handle);
      const counts = Object.fromEntries(
        players.map((p) => [p.id, [p.roundsCount, p.greeniesCount]]),
      );
      expect(counts).toEqual({ [regular.id]: [2, 2], [newcomer.id]: [0, 0] });
    });
  });
});
