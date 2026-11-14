import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { createRoundFixtures } from "@/test/fixtures/rounds";
import * as clubs from "../index";
import type { PointRules } from "../point-rules";

const { revalidatePath, updateTag } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath, updateTag }));

const POINT_RULES: PointRules = {
  participation: 5,
  pars: 1,
  birdies: 2,
  eagles: 3,
  aces: 10,
  strokes: { positions: [10, 5] },
  putts: { positions: [4] },
  greenies: { tiers: [{ maxFt: 3, pts: 2 }, { maxFt: null, pts: 1 }] },
};

const LOGO = "https://example.com/logo.png";

describe("Club writes", () => {
  const fixtures = createRoundFixtures(db, schema);
  let admin: Awaited<ReturnType<typeof fixtures.player>>;
  let player: Awaited<ReturnType<typeof fixtures.player>>;

  function input(overrides: Partial<clubs.ClubWriteInput> = {}): clubs.ClubWriteInput {
    const suffix = crypto.randomUUID();
    return {
      handle: `club-${suffix}`,
      name: `Club ${suffix}`,
      logo: LOGO,
      pointRules: POINT_RULES,
      ...overrides,
    };
  }

  beforeEach(async () => {
    admin = await fixtures.player({ isAdmin: true });
    player = await fixtures.player();
    revalidatePath.mockClear();
    updateTag.mockClear();
  });

  describe("createClub", () => {
    it("creates a Club and refreshes the Clubs pages", async () => {
      const values = input();
      expect(await clubs.createClub(admin.id, values)).toEqual({ ok: true });
      expect(await clubs.getClubByHandle(values.handle)).toMatchObject({
        handle: values.handle,
        name: values.name,
        logo: LOGO,
        pointRules: POINT_RULES,
      });
      expect(revalidatePath).toHaveBeenCalled();
      expect(updateTag).not.toHaveBeenCalled();
    });

    it("refuses a Player who isn't a Platform Admin", async () => {
      const values = input();
      const result = await clubs.createClub(player.id, values);
      expect(result).toEqual({ ok: false, error: expect.stringMatching(/Platform Admin/) });
      expect(await clubs.getClubByHandle(values.handle)).toBeNull();
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("stores a blank logo as none", async () => {
      const values = input({ logo: "" });
      await clubs.createClub(admin.id, values);
      expect((await clubs.getClubByHandle(values.handle))?.logo).toBeNull();
    });

    it("refuses a handle already in use", async () => {
      const values = input();
      await clubs.createClub(admin.id, values);
      revalidatePath.mockClear();
      const result = await clubs.createClub(admin.id, { ...values, name: "Other" });
      expect(result).toEqual({ ok: false, error: "A club with that handle already exists." });
      expect((await clubs.getClubByHandle(values.handle))?.name).toBe(values.name);
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("updateClub", () => {
    async function existing() {
      const values = input();
      await clubs.createClub(admin.id, values);
      revalidatePath.mockClear();
      return values;
    }

    it("changes name, logo and Point Rules, and refreshes Clubs pages and home Events", async () => {
      const values = await existing();
      const pointRules = { ...POINT_RULES, participation: 9 };
      const result = await clubs.updateClub(admin.id, {
        handle: values.handle,
        name: "Renamed",
        logo: "",
        pointRules,
      });
      expect(result).toEqual({ ok: true });
      expect(await clubs.getClubByHandle(values.handle)).toMatchObject({
        name: "Renamed",
        logo: null,
        pointRules,
      });
      expect(revalidatePath).toHaveBeenCalled();
      expect(updateTag).toHaveBeenCalledWith("home-events");
    });

    it("refuses a Player who isn't a Platform Admin", async () => {
      const values = await existing();
      const result = await clubs.updateClub(player.id, { ...values, name: "Renamed" });
      expect(result).toEqual({ ok: false, error: expect.stringMatching(/Platform Admin/) });
      expect((await clubs.getClubByHandle(values.handle))?.name).toBe(values.name);
      expect(revalidatePath).not.toHaveBeenCalled();
      expect(updateTag).not.toHaveBeenCalled();
    });

    it("refuses an unknown handle", async () => {
      const result = await clubs.updateClub(admin.id, input());
      expect(result).toEqual({ ok: false, error: "Club not found." });
      expect(revalidatePath).not.toHaveBeenCalled();
      expect(updateTag).not.toHaveBeenCalled();
    });
  });
});
