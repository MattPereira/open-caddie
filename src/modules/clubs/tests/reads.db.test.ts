import { describe, expect, it } from "vitest";

import { startNextSeason } from "@/modules/seasons/server";
import { withTransaction } from "@/test/db/connections";
import { createFixtures, PAR_THREE_HOLES } from "@/test/fixtures";
import * as clubs from "../server";
import type { PointRules } from "../index";

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
  const fixtures = createFixtures();

  async function club({ seasons = 0 } = {}) {
    const created = await fixtures.club({ pointRules: POINT_RULES });
    const seasonIds: Record<number, number> = {};
    for (let i = 0; i < seasons; i += 1) {
      const season = await withTransaction((tx) =>
        startNextSeason(tx, created.id),
      );
      seasonIds[season.number] = season.id;
    }
    return { club: created, seasonIds };
  }

  async function round(playerId: string, { greenies = 0 } = {}) {
    const { id: roundId } = await fixtures.casualRound({ playerId });
    const holes = PAR_THREE_HOLES.slice(0, greenies);
    if (holes.length > 0) {
      await fixtures.scores(
        roundId,
        holes.map((hole) => ({ hole, strokes: 3, putts: 1 })),
      );
      for (const hole of holes) {
        await fixtures.greenie(roundId, hole, { feet: 5, inches: 0 });
      }
    }
  }

  async function tournament(
    owner: { id: number; handle: string },
    seasonId: number,
  ) {
    await fixtures.tournament({ club: owner, seasonId });
  }

  describe("getAllClubsWithSeasons", () => {
    it("makes the highest-numbered Season the Current Season", async () => {
      const { club: created, seasonIds } = await club({ seasons: 3 });
      const row = (await clubs.getAllClubsWithSeasons()).find(
        (c) => c.id === created.id,
      );
      expect(row?.seasons.map((s) => s.number)).toEqual([1, 2, 3]);
      expect(row?.currentSeasonId).toBe(seasonIds[3]);
    });

    it("has no Current Season when the Club has no Seasons", async () => {
      const { club: created } = await club();
      const row = (await clubs.getAllClubsWithSeasons()).find(
        (c) => c.id === created.id,
      );
      expect(row).toMatchObject({ seasons: [], currentSeasonId: null });
    });
  });

  describe("getAllClubsFull", () => {
    it("counts Club Members and Tournaments", async () => {
      const { club: created, seasonIds } = await club({ seasons: 2 });
      await fixtures.clubMember(created.id, (await fixtures.player()).id);
      await fixtures.clubMember(created.id, (await fixtures.player()).id);
      await tournament(created, seasonIds[1]);
      await tournament(created, seasonIds[2]);
      await tournament(created, seasonIds[2]);
      const row = (await clubs.getAllClubsFull()).find(
        (c) => c.id === created.id,
      );
      expect(row).toEqual({
        id: created.id,
        handle: created.handle,
        name: created.name,
        logo: null,
        pointRules: POINT_RULES,
        membersCount: 2,
        tournamentsCount: 3,
      });
    });

    it("counts zero for a Club with no Players or Tournaments", async () => {
      const { club: created } = await club();
      const row = (await clubs.getAllClubsFull()).find(
        (c) => c.id === created.id,
      );
      expect(row).toMatchObject({ membersCount: 0, tournamentsCount: 0 });
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
      expect(
        await clubs.getClubByHandle(`missing-${crypto.randomUUID()}`),
      ).toBeNull();
    });
  });

  describe("getClubMembersByHandle", () => {
    it("returns Club Members with Round and Greenie counts", async () => {
      const { club: created } = await club();
      const { club: other } = await club();
      const regular = await fixtures.player();
      const newcomer = await fixtures.player();
      const outsider = await fixtures.player();
      await fixtures.clubMember(created.id, regular.id);
      await fixtures.clubMember(created.id, newcomer.id);
      await fixtures.clubMember(other.id, outsider.id);
      await round(regular.id, { greenies: 2 });
      await round(regular.id);

      const players = await clubs.getClubMembersByHandle(created.handle);
      const counts = Object.fromEntries(
        players.map((p) => [p.id, [p.roundsCount, p.greeniesCount]]),
      );
      expect(counts).toEqual({ [regular.id]: [2, 2], [newcomer.id]: [0, 0] });
    });
  });
});
