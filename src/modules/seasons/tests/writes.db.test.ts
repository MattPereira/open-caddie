import { describe, expect, it } from "vitest";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { getOrCreateCurrentSeason, requireClubSeason, startNextSeason } from "../index";

describe("Season writes", () => {
  async function club() {
    const suffix = crypto.randomUUID();
    const [created] = await db.insert(schema.clubs).values({
      handle: `club-${suffix}`,
      name: `Club ${suffix}`,
      pointRules: { participation: 0, pars: 0, birdies: 0, eagles: 0, aces: 0, strokes: { positions: [0] }, putts: { positions: [0] }, greenies: { tiers: [{ maxFt: null, pts: 0 }] } },
    }).returning();
    return created;
  }

  const startNext = (clubId: number) => db.transaction((tx) => startNextSeason(tx, clubId));
  const current = (clubId: number) => db.transaction((tx) => getOrCreateCurrentSeason(tx, clubId));

  const seasonNumbers = async (clubId: number) =>
    (await db.select().from(schema.seasons).where(eq(schema.seasons.clubId, clubId)).orderBy(schema.seasons.number))
      .map(({ number }) => number);

  describe("startNextSeason", () => {
    it("starts Season 1 when the Club has none", async () => {
      const c = await club();
      expect(await startNext(c.id)).toMatchObject({ clubId: c.id, number: 1 });
    });

    it("numbers after the Current Season", async () => {
      const c = await club();
      await startNext(c.id);
      expect(await startNext(c.id)).toMatchObject({ number: 2 });
    });

    it("serializes concurrent starts", async () => {
      const c = await club();
      await Promise.all([startNext(c.id), startNext(c.id)]);
      expect(await seasonNumbers(c.id)).toEqual([1, 2]);
    });
  });

  describe("getOrCreateCurrentSeason", () => {
    it("creates Season 1 when the Club has none", async () => {
      const c = await club();
      expect(await current(c.id)).toMatchObject({ clubId: c.id, number: 1 });
      expect(await seasonNumbers(c.id)).toEqual([1]);
    });

    it("returns the highest-numbered Season without creating one", async () => {
      const c = await club();
      await startNext(c.id);
      const second = await startNext(c.id);
      expect(await current(c.id)).toEqual(second);
      expect(await seasonNumbers(c.id)).toEqual([1, 2]);
    });

    it("serializes concurrent first calls", async () => {
      const c = await club();
      const [a, b] = await Promise.all([current(c.id), current(c.id)]);
      expect(a).toEqual(b);
      expect(await seasonNumbers(c.id)).toEqual([1]);
    });
  });

  describe("requireClubSeason", () => {
    it("returns a Past Season of the Club", async () => {
      const c = await club();
      const first = await startNext(c.id);
      await startNext(c.id);
      expect(await db.transaction((tx) => requireClubSeason(tx, first.id, c.id))).toEqual(first);
    });

    it("refuses another Club's Season", async () => {
      const [a, b] = [await club(), await club()];
      const other = await startNext(b.id);
      await expect(db.transaction((tx) => requireClubSeason(tx, other.id, a.id)))
        .rejects.toThrow("Selected Season does not belong to this Club.");
    });
  });
});
