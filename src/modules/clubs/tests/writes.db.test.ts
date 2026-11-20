import { revalidatePath, updateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFixtures } from "@/test/fixtures";
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
  greenies: {
    tiers: [
      { maxFt: 3, pts: 2 },
      { maxFt: null, pts: 1 },
    ],
  },
};

const LOGO = "https://example.com/logo.png";

describe("Club writes", () => {
  const fixtures = createFixtures();
  let admin: Awaited<ReturnType<typeof fixtures.player>>;
  let player: Awaited<ReturnType<typeof fixtures.player>>;

  function input(
    overrides: Partial<clubs.ClubWriteInput> = {},
  ): clubs.ClubWriteInput {
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
    vi.mocked(revalidatePath).mockClear();
  });

  describe("createClub", () => {
    it("creates a Club and refreshes the Clubs pages", async () => {
      const values = input();
      expect(await clubs.createClub(admin.id, values)).toEqual({
        ok: true,
        id: expect.any(Number),
      });
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
      expect(result).toEqual({
        ok: false,
        error: expect.stringMatching(/Platform Admin/),
      });
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
      vi.mocked(revalidatePath).mockClear();
      const result = await clubs.createClub(admin.id, {
        ...values,
        name: "Other",
      });
      expect(result).toEqual({
        ok: false,
        error: "A club with that handle already exists.",
      });
      expect((await clubs.getClubByHandle(values.handle))?.name).toBe(
        values.name,
      );
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("updateClub", () => {
    async function existing() {
      const values = input();
      await clubs.createClub(admin.id, values);
      vi.mocked(revalidatePath).mockClear();
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
      const result = await clubs.updateClub(player.id, {
        ...values,
        name: "Renamed",
      });
      expect(result).toEqual({
        ok: false,
        error: expect.stringMatching(/Platform Admin/),
      });
      expect((await clubs.getClubByHandle(values.handle))?.name).toBe(
        values.name,
      );
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

  describe("addClubMember", () => {
    async function existing() {
      const values = input();
      const created = await clubs.createClub(admin.id, values);
      if (!created.ok) throw new Error(created.error);
      vi.mocked(revalidatePath).mockClear();
      return { id: created.id, handle: values.handle };
    }

    const memberIds = async (handle: string) =>
      (await clubs.getClubMembersByHandle(handle)).map((m) => m.id);

    it("adds the Player to the Club and refreshes Clubs pages", async () => {
      const club = await existing();
      expect(
        await clubs.addClubMember(admin.id, {
          clubId: club.id,
          playerId: player.id,
        }),
      ).toEqual({ ok: true });
      expect(await memberIds(club.handle)).toEqual([player.id]);
      expect(revalidatePath).toHaveBeenCalled();
    });

    it("is a no-op for a Player already in the Club", async () => {
      const club = await existing();
      const values = { clubId: club.id, playerId: player.id };
      await clubs.addClubMember(admin.id, values);
      expect(await clubs.addClubMember(admin.id, values)).toEqual({ ok: true });
      expect(await memberIds(club.handle)).toEqual([player.id]);
    });

    it("refuses a Player who isn't a Platform Admin", async () => {
      const club = await existing();
      const result = await clubs.addClubMember(player.id, {
        clubId: club.id,
        playerId: player.id,
      });
      expect(result).toEqual({
        ok: false,
        error: expect.stringMatching(/Platform Admin/),
      });
      expect(await memberIds(club.handle)).toEqual([]);
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("refuses an unknown Club or Player", async () => {
      const club = await existing();
      expect(
        await clubs.addClubMember(admin.id, {
          clubId: club.id,
          playerId: crypto.randomUUID(),
        }),
      ).toEqual({ ok: false, error: "Club or Player not found." });
      expect(
        await clubs.addClubMember(admin.id, {
          clubId: 2_000_000_000,
          playerId: player.id,
        }),
      ).toEqual({ ok: false, error: "Club or Player not found." });
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });
});
