import { beforeEach, describe, expect, it, vi } from "vitest";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { createRoundFixtures } from "@/lib/rounds/test-fixtures";
import * as players from "../index";

const { revalidatePath, del } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  del: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@vercel/blob", () => ({ del }));

const BLOB = "https://abc.public.blob.vercel-storage.com";

describe("Player writes", () => {
  const fixtures = createRoundFixtures(db, schema);
  let admin: Awaited<ReturnType<typeof fixtures.player>>;
  let player: Awaited<ReturnType<typeof fixtures.player>>;

  function input(overrides: Partial<players.PlayerCreateInput> = {}) {
    return {
      email: `new-${crypto.randomUUID()}@example.com`,
      firstName: "Ann",
      lastName: "Lee",
      username: "",
      image: "",
      isAdmin: false,
      ...overrides,
    };
  }

  function editOf(
    target: typeof player,
    overrides: Partial<players.PlayerUpdateInput> = {},
  ): players.PlayerUpdateInput {
    return {
      id: target.id,
      email: target.email ?? "",
      firstName: target.firstName ?? "",
      lastName: target.lastName ?? "",
      username: target.username ?? "",
      image: target.image ?? "",
      isAdmin: target.isAdmin,
      ...overrides,
    };
  }

  async function stored(id: string) {
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return row;
  }

  async function storedByEmail(email: string) {
    const [row] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    return row;
  }

  function refreshed() {
    const calls = revalidatePath.mock.calls as unknown as string[][];
    return [...new Set(calls.map((call) => call.join(" ")))].sort();
  }

  beforeEach(async () => {
    admin = await fixtures.player({ isAdmin: true });
    player = await fixtures.player();
    revalidatePath.mockClear();
    del.mockReset();
  });

  describe("createPlayer", () => {
    it("creates a Player, cleaning up blank fields and the email", async () => {
      const email = `New-${crypto.randomUUID()}@Example.com`;
      const result = await players.createPlayer(
        admin.id,
        input({ email, firstName: " Ann ", lastName: "  ", username: "  ", isAdmin: true }),
      );

      expect(result).toEqual({ ok: true });
      expect(await storedByEmail(email.toLowerCase())).toMatchObject({
        firstName: "Ann",
        lastName: null,
        username: null,
        image: null,
        isAdmin: true,
        name: "Ann",
      });
      expect(refreshed()).toEqual(["/players"]);
    });

    it("stores the full name, username and image", async () => {
      const values = input({ username: "ann-lee", image: `${BLOB}/a.png` });
      expect(await players.createPlayer(admin.id, values)).toEqual({ ok: true });
      expect(await storedByEmail(values.email)).toMatchObject({
        name: "Ann Lee",
        username: "ann-lee",
        image: `${BLOB}/a.png`,
        isAdmin: false,
      });
    });

    it("refuses a Player who isn't a Platform Admin", async () => {
      const values = input();
      const result = await players.createPlayer(player.id, values);
      expect(result).toMatchObject({ ok: false });
      expect(await storedByEmail(values.email)).toBeUndefined();
    });

    it("refuses an email already in use, ignoring case", async () => {
      const result = await players.createPlayer(
        admin.id,
        input({ email: player.email!.toUpperCase() }),
      );
      expect(result).toEqual({ ok: false, error: "That email is already in use." });
    });

    it("refuses a username already in use", async () => {
      await db.update(schema.users).set({ username: "taken" }).where(eq(schema.users.id, player.id));
      const result = await players.createPlayer(admin.id, input({ username: "taken" }));
      expect(result).toEqual({ ok: false, error: "That username is already in use." });
    });
  });

  describe("updatePlayer", () => {
    it("lets a Player edit their own profile", async () => {
      const result = await players.updatePlayer(
        player.id,
        editOf(player, { firstName: "New", lastName: "Name", username: "newname" }),
      );
      expect(result).toEqual({ ok: true });
      expect(await stored(player.id)).toMatchObject({
        firstName: "New",
        lastName: "Name",
        username: "newname",
        name: "New Name",
      });
    });

    it("refuses a Player editing someone else", async () => {
      const other = await fixtures.player();
      const result = await players.updatePlayer(player.id, editOf(other, { firstName: "Hacked" }));
      expect(result).toEqual({ ok: false, error: "You can only edit your own profile." });
      expect((await stored(other.id)).firstName).toBe("Player");
    });

    it("ignores a non-admin's Platform Admin value", async () => {
      const result = await players.updatePlayer(player.id, editOf(player, { isAdmin: true }));
      expect(result).toEqual({ ok: true });
      expect((await stored(player.id)).isAdmin).toBe(false);
    });

    it("lets a Platform Admin edit anyone and grant or remove Platform Admin", async () => {
      expect(await players.updatePlayer(admin.id, editOf(player, { isAdmin: true }))).toEqual({ ok: true });
      expect((await stored(player.id)).isAdmin).toBe(true);
      expect(await players.updatePlayer(admin.id, editOf(player, { isAdmin: false }))).toEqual({ ok: true });
      expect((await stored(player.id)).isAdmin).toBe(false);
    });

    it("clears email verification only when the email changes", async () => {
      const verified = new Date("2026-01-01T00:00:00.000Z");
      await db.update(schema.users).set({ emailVerified: verified }).where(eq(schema.users.id, player.id));

      await players.updatePlayer(player.id, editOf(player, { email: player.email!.toUpperCase() }));
      expect((await stored(player.id)).emailVerified).toEqual(verified);

      const email = `changed-${crypto.randomUUID()}@example.com`;
      await players.updatePlayer(player.id, editOf(player, { email }));
      expect(await stored(player.id)).toMatchObject({ email, emailVerified: null });
    });

    it("refuses an email or username another Player uses, but not their own", async () => {
      const other = await fixtures.player();
      await db.update(schema.users).set({ username: "other" }).where(eq(schema.users.id, other.id));
      await db.update(schema.users).set({ username: "mine" }).where(eq(schema.users.id, player.id));
      const me = await stored(player.id);

      expect(await players.updatePlayer(player.id, editOf(me, { email: other.email! }))).toEqual({
        ok: false,
        error: "That email is already in use.",
      });
      expect(await players.updatePlayer(player.id, editOf(me, { username: "other" }))).toEqual({
        ok: false,
        error: "That username is already in use.",
      });
      expect(await players.updatePlayer(player.id, editOf(me))).toEqual({ ok: true });
    });

    it("refuses a Player who doesn't exist", async () => {
      const missing = { ...player, id: crypto.randomUUID() };
      expect(await players.updatePlayer(admin.id, editOf(missing))).toEqual({
        ok: false,
        error: "Player not found.",
      });
    });

    it("deletes the old image when it's replaced or removed", async () => {
      await db.update(schema.users).set({ image: `${BLOB}/old.png` }).where(eq(schema.users.id, player.id));
      const me = await stored(player.id);

      await players.updatePlayer(player.id, editOf(me));
      expect(del).not.toHaveBeenCalled();

      await players.updatePlayer(player.id, editOf(me, { image: `${BLOB}/new.png` }));
      expect(del).toHaveBeenCalledWith(`${BLOB}/old.png`);

      await players.updatePlayer(player.id, editOf(me, { image: "" }));
      expect(del).toHaveBeenLastCalledWith(`${BLOB}/new.png`);
      expect((await stored(player.id)).image).toBeNull();
    });

    it("refreshes the Players list, the Player's profile and Club pages", async () => {
      await players.updatePlayer(player.id, editOf(player));
      expect(refreshed()).toEqual(["/clubs/[handle] page", "/players", `/players/${player.id}`]);
    });
  });

  describe("deletePlayer", () => {
    it("deletes a Player with no Rounds or Greenies", async () => {
      expect(await players.deletePlayer(admin.id, player.id)).toEqual({ ok: true });
      expect(await stored(player.id)).toBeUndefined();
      expect(refreshed()).toEqual(["/players", `/players/${player.id}`]);
    });

    it("refuses a Player who isn't a Platform Admin", async () => {
      const other = await fixtures.player();
      expect(await players.deletePlayer(player.id, other.id)).toMatchObject({ ok: false });
      expect(await stored(other.id)).toBeDefined();
    });

    it("refuses deleting yourself", async () => {
      expect(await players.deletePlayer(admin.id, admin.id)).toEqual({
        ok: false,
        error: "You cannot delete your own account.",
      });
      expect(await stored(admin.id)).toBeDefined();
    });

    it("refuses a Player with Rounds or Greenies, giving the counts", async () => {
      const t = await fixtures.tournament();
      const { player: entrant, round } = await fixtures.tournamentPlayer(t);
      await db.insert(schema.roundScores).values({ roundId: round.id, hole: 3, strokes: 3, putts: 1 });
      await db.insert(schema.greenies).values({ roundId: round.id, hole: 3, feet: 4, inches: 0 });

      expect(await players.deletePlayer(admin.id, entrant.id)).toEqual({
        ok: false,
        error: "Cannot delete: player has 1 round(s) and 1 greenie(s).",
      });
      expect(await stored(entrant.id)).toBeDefined();
      expect(refreshed()).toEqual([]);
    });
  });
});
