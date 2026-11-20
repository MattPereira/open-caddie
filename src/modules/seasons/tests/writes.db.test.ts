import { describe, expect, it } from "vitest";

import { withTransaction } from "@/test/db/connections";
import { createFixtures } from "@/test/fixtures";
import {
  getClubSeasonNumbers,
  getOrCreateCurrentSeason,
  requireClubSeason,
  startNextSeason,
} from "../server";

describe("Season writes", () => {
  const fixtures = createFixtures();
  const club = fixtures.club;

  const startNext = (clubId: number) =>
    withTransaction((tx) => startNextSeason(tx, clubId));
  const current = (clubId: number) =>
    withTransaction((tx) => getOrCreateCurrentSeason(tx, clubId));

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
      expect(await getClubSeasonNumbers(c.id)).toEqual([1, 2]);
    });
  });

  describe("getOrCreateCurrentSeason", () => {
    it("creates Season 1 when the Club has none", async () => {
      const c = await club();
      expect(await current(c.id)).toMatchObject({ clubId: c.id, number: 1 });
      expect(await getClubSeasonNumbers(c.id)).toEqual([1]);
    });

    it("returns the highest-numbered Season without creating one", async () => {
      const c = await club();
      await startNext(c.id);
      const second = await startNext(c.id);
      expect(await current(c.id)).toEqual(second);
      expect(await getClubSeasonNumbers(c.id)).toEqual([1, 2]);
    });

    it("serializes concurrent first calls", async () => {
      const c = await club();
      const [a, b] = await Promise.all([current(c.id), current(c.id)]);
      expect(a).toEqual(b);
      expect(await getClubSeasonNumbers(c.id)).toEqual([1]);
    });
  });

  describe("requireClubSeason", () => {
    it("returns a Past Season of the Club", async () => {
      const c = await club();
      const first = await startNext(c.id);
      await startNext(c.id);
      expect(
        await withTransaction((tx) => requireClubSeason(tx, first.id, c.id)),
      ).toEqual(first);
    });

    it("refuses another Club's Season", async () => {
      const [a, b] = [await club(), await club()];
      const other = await startNext(b.id);
      await expect(
        withTransaction((tx) => requireClubSeason(tx, other.id, a.id)),
      ).rejects.toThrow("Selected Season does not belong to this Club.");
    });
  });
});
