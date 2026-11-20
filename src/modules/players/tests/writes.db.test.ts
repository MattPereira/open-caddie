import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { required } from "@/lib/required";
import { markEmailVerified } from "@/test/db/seed";
import { createFixtures } from "@/test/fixtures";
import * as players from "../server";

const { del } = vi.hoisted(() => ({ del: vi.fn() }));
vi.mock("@vercel/blob", () => ({ del }));

const BLOB = "https://abc.public.blob.vercel-storage.com";

type Editable = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  username?: string | null;
  image?: string | null;
  isAdmin: boolean;
};

describe("Player writes", () => {
  const fixtures = createFixtures();
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
    target: Editable,
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
    return required(await players.getPlayerById(id), "stored player");
  }

  async function created(result: players.PlayerCreateResult) {
    if (!result.ok) throw new Error(result.error);
    return stored(result.id);
  }

  async function setUsername(target: Editable, username: string) {
    expect(
      await players.updatePlayer(admin.id, editOf(target, { username })),
    ).toEqual({ ok: true });
  }

  function refreshed() {
    const calls = vi.mocked(revalidatePath).mock.calls;
    return [...new Set(calls.map((call) => call.join(" ")))].sort();
  }

  beforeEach(async () => {
    admin = await fixtures.player({ isAdmin: true });
    player = await fixtures.player();
    del.mockReset();
  });

  describe("completeOnboarding", () => {
    const shortId = () => crypto.randomUUID().slice(0, 8);

    it("saves the name and a username slugged from it", async () => {
      const lastName = `Lee ${shortId()}`;
      const result = await players.completeOnboarding(player.id, {
        firstName: "Ann",
        lastName,
      });
      const username = `ann-${lastName.toLowerCase().replace(" ", "-")}`;
      expect(result).toEqual({ ok: true, username });
      expect(await stored(player.id)).toMatchObject({
        firstName: "Ann",
        lastName,
        name: `Ann ${lastName}`,
        username,
      });
    });

    it("appends a suffix when the username is taken", async () => {
      const lastName = shortId();
      const other = await fixtures.player();
      await players.completeOnboarding(other.id, {
        firstName: "Ann",
        lastName,
      });

      expect(
        await players.completeOnboarding(player.id, {
          firstName: "Ann",
          lastName,
        }),
      ).toEqual({ ok: true, username: `ann-${lastName}-2` });
    });
  });

  describe("createPlayer", () => {
    it("creates a Player, cleaning up blank fields and the email", async () => {
      const email = `New-${crypto.randomUUID()}@Example.com`;
      const result = await players.createPlayer(
        admin.id,
        input({
          email,
          firstName: " Ann ",
          lastName: "  ",
          username: "  ",
          isAdmin: true,
        }),
      );

      expect(result).toEqual({
        ok: true,
        id: expect.any(String),
        email: email.toLowerCase(),
      });
      expect(await created(result)).toMatchObject({
        email: email.toLowerCase(),
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
      const result = await players.createPlayer(admin.id, values);
      expect(result).toEqual({
        ok: true,
        id: expect.any(String),
        email: values.email,
      });
      expect(await created(result)).toMatchObject({
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
      expect(await players.hasPlayerWithEmail(values.email)).toBe(false);
    });

    it("refuses an email already in use, ignoring case", async () => {
      const result = await players.createPlayer(
        admin.id,
        input({ email: required(player.email, "fixture email").toUpperCase() }),
      );
      expect(result).toEqual({
        ok: false,
        error: "That email is already in use.",
      });
    });

    it("refuses a username already in use", async () => {
      const taken = `taken-${crypto.randomUUID()}`;
      await setUsername(player, taken);
      const result = await players.createPlayer(
        admin.id,
        input({ username: taken }),
      );
      expect(result).toEqual({
        ok: false,
        error: "That username is already in use.",
      });
    });
  });

  describe("updatePlayer", () => {
    it("lets a Player edit their own profile", async () => {
      const result = await players.updatePlayer(
        player.id,
        editOf(player, {
          firstName: "New",
          lastName: "Name",
          username: "newname",
        }),
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
      const result = await players.updatePlayer(
        player.id,
        editOf(other, { firstName: "Hacked" }),
      );
      expect(result).toEqual({
        ok: false,
        error: "You can only edit your own profile.",
      });
      expect((await stored(other.id)).firstName).toBe(other.firstName);
    });

    it("ignores a non-admin's Platform Admin value", async () => {
      const result = await players.updatePlayer(
        player.id,
        editOf(player, { isAdmin: true }),
      );
      expect(result).toEqual({ ok: true });
      expect((await stored(player.id)).isAdmin).toBe(false);
    });

    it("lets a Platform Admin edit anyone and grant or remove Platform Admin", async () => {
      expect(
        await players.updatePlayer(admin.id, editOf(player, { isAdmin: true })),
      ).toEqual({ ok: true });
      expect((await stored(player.id)).isAdmin).toBe(true);
      expect(
        await players.updatePlayer(
          admin.id,
          editOf(player, { isAdmin: false }),
        ),
      ).toEqual({ ok: true });
      expect((await stored(player.id)).isAdmin).toBe(false);
    });

    it("clears email verification only when the email changes", async () => {
      const verified = new Date("2026-01-01T00:00:00.000Z");
      await markEmailVerified(player.id, verified);

      await players.updatePlayer(
        player.id,
        editOf(player, {
          email: required(player.email, "fixture email").toUpperCase(),
        }),
      );
      expect((await stored(player.id)).emailVerified).toEqual(verified);

      const email = `changed-${crypto.randomUUID()}@example.com`;
      await players.updatePlayer(player.id, editOf(player, { email }));
      expect(await stored(player.id)).toMatchObject({
        email,
        emailVerified: null,
      });
    });

    it("refuses an email or username another Player uses, but keeps their own username", async () => {
      const other = await fixtures.player();
      const otherUsername = `other-${crypto.randomUUID()}`;
      await setUsername(other, otherUsername);
      await setUsername(player, `mine-${crypto.randomUUID()}`);
      const me = await stored(player.id);

      expect(
        await players.updatePlayer(
          player.id,
          editOf(me, { email: required(other.email, "fixture email") }),
        ),
      ).toEqual({
        ok: false,
        error: "That email is already in use.",
      });
      expect(
        await players.updatePlayer(
          player.id,
          editOf(me, { username: otherUsername }),
        ),
      ).toEqual({
        ok: false,
        error: "That username is already in use.",
      });
      expect(await players.updatePlayer(player.id, editOf(me))).toEqual({
        ok: true,
      });
    });

    it("refuses a Player who doesn't exist", async () => {
      const missing = { ...player, id: crypto.randomUUID() };
      expect(await players.updatePlayer(admin.id, editOf(missing))).toEqual({
        ok: false,
        error: "Player not found.",
      });
    });

    it("deletes the old image when it's replaced or removed", async () => {
      expect(
        await players.updatePlayer(
          player.id,
          editOf(player, { image: `${BLOB}/old.png` }),
        ),
      ).toEqual({ ok: true });
      del.mockReset();
      const me = await stored(player.id);

      await players.updatePlayer(player.id, editOf(me));
      expect(del).not.toHaveBeenCalled();

      await players.updatePlayer(
        player.id,
        editOf(me, { image: `${BLOB}/new.png` }),
      );
      expect(del).toHaveBeenCalledWith(`${BLOB}/old.png`);

      await players.updatePlayer(player.id, editOf(me, { image: "" }));
      expect(del).toHaveBeenLastCalledWith(`${BLOB}/new.png`);
      expect((await stored(player.id)).image).toBeNull();
    });

    it("refreshes the Players list, the Player's profile and Club pages", async () => {
      await players.updatePlayer(player.id, editOf(player));
      expect(refreshed()).toEqual([
        "/clubs/[handle] page",
        "/players",
        `/players/${player.id}`,
      ]);
    });
  });

  describe("deletePlayer", () => {
    it("deletes a Player with no Rounds or Greenies", async () => {
      expect(await players.deletePlayer(admin.id, player.id)).toEqual({
        ok: true,
      });
      expect(await players.getPlayerById(player.id)).toBeNull();
      expect(refreshed()).toEqual(["/players", `/players/${player.id}`]);
    });

    it("refuses a Player who isn't a Platform Admin", async () => {
      const other = await fixtures.player();
      expect(await players.deletePlayer(player.id, other.id)).toMatchObject({
        ok: false,
      });
      expect(await players.getPlayerById(other.id)).not.toBeNull();
    });

    it("refuses deleting yourself", async () => {
      expect(await players.deletePlayer(admin.id, admin.id)).toEqual({
        ok: false,
        error: "You cannot delete your own account.",
      });
      expect(await players.getPlayerById(admin.id)).not.toBeNull();
    });

    it("refuses a Player with Rounds, giving the count", async () => {
      const t = await fixtures.tournament();
      const { player: entrant } = await fixtures.tournamentPlayer(t);
      expect(await players.deletePlayer(admin.id, entrant.id)).toEqual({
        ok: false,
        error: "Cannot delete: player has 1 round(s).",
      });
      expect(await players.getPlayerById(entrant.id)).not.toBeNull();
      expect(refreshed()).toEqual([]);
    });
  });
});
