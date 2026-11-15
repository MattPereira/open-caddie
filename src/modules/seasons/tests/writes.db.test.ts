import { describe, expect, it } from "vitest";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { requireClubSeason, resolveNewTournamentSeason } from "../index";

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

  const resolve = (clubId: number, seasonId: number | null, startNextSeason = false) =>
    db.transaction((tx) => resolveNewTournamentSeason(tx, clubId, { seasonId, startNextSeason }));

  const seasonNumbers = async (clubId: number) =>
    (await db.select().from(schema.seasons).where(eq(schema.seasons.clubId, clubId)).orderBy(schema.seasons.number))
      .map(({ number }) => number);

  it("creates Season 1 when the Club has none", async () => {
    const c = await club();
    expect(await resolve(c.id, null)).toMatchObject({ clubId: c.id, number: 1 });
    expect(await seasonNumbers(c.id)).toEqual([1]);
  });

  it("defaults to the Current Season without creating one", async () => {
    const c = await club();
    await resolve(c.id, null);
    const second = await resolve(c.id, null, true);
    expect(await resolve(c.id, null)).toEqual(second);
    expect(await seasonNumbers(c.id)).toEqual([1, 2]);
  });

  it("starts the next Season, ignoring a picked Season", async () => {
    const c = await club();
    const first = await resolve(c.id, null);
    expect(await resolve(c.id, first.id, true)).toMatchObject({ number: 2 });
  });

  it("starts Season 1 as the next Season of an empty Club", async () => {
    const c = await club();
    expect(await resolve(c.id, null, true)).toMatchObject({ number: 1 });
  });

  it("uses a picked Past Season", async () => {
    const c = await club();
    const first = await resolve(c.id, null);
    await resolve(c.id, null, true);
    expect(await resolve(c.id, first.id)).toEqual(first);
  });

  it("serializes concurrent next-Season starts", async () => {
    const c = await club();
    await Promise.all([resolve(c.id, null, true), resolve(c.id, null, true)]);
    expect(await seasonNumbers(c.id)).toEqual([1, 2]);
  });

  it("refuses another Club's Season", async () => {
    const [a, b] = [await club(), await club()];
    const other = await resolve(b.id, null);
    const error = "Selected Season does not belong to this Club.";
    await expect(resolve(a.id, other.id)).rejects.toThrow(error);
    await expect(db.transaction((tx) => requireClubSeason(tx, other.id, a.id))).rejects.toThrow(error);
  });
});
