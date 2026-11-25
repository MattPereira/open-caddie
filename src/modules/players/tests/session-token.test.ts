import { describe, expect, it } from "vitest";

import { sessionTokenClaims } from "@/modules/players";

const signedIn = {
  id: "player-1",
  username: "bogey",
  firstName: "Bo",
  lastName: "Gee",
  name: "Bo Gee",
  isPlatformAdmin: true,
};

describe("sessionTokenClaims", () => {
  it("copies the Player's row onto the token at sign-in", () => {
    expect(
      sessionTokenClaims({ token: { sub: "x" }, player: signedIn }),
    ).toEqual({
      sub: "x",
      id: "player-1",
      username: "bogey",
      firstName: "Bo",
      lastName: "Gee",
      isPlatformAdmin: true,
    });
  });

  it("fills missing sign-in fields with null and the Platform Admin claim with false", () => {
    expect(
      sessionTokenClaims({ token: {}, player: { id: "player-2" } }),
    ).toEqual({
      id: "player-2",
      username: null,
      firstName: null,
      lastName: null,
      isPlatformAdmin: false,
    });
  });

  it("refuses a signed-in Player without an id", () => {
    expect(() =>
      sessionTokenClaims({ token: {}, player: { username: "ghost" } }),
    ).toThrow("Auth.js adapter returned a user without an id");
  });

  it("keeps the Platform Admin claim written at sign-in on refresh", () => {
    expect(
      sessionTokenClaims({ token: { id: "p", isPlatformAdmin: true } }),
    ).toEqual({ id: "p", isPlatformAdmin: true });
    expect(
      sessionTokenClaims({ token: { id: "p", isPlatformAdmin: false } }),
    ).toEqual({ id: "p", isPlatformAdmin: false });
  });

  it("leaves a token minted without the Platform Admin claim without it until sign-in", () => {
    expect(sessionTokenClaims({ token: { id: "p" } })).toEqual({ id: "p" });
  });

  it("copies only the profile fields a session update names", () => {
    const token = {
      id: "p",
      username: "old",
      firstName: "Old",
      lastName: "Name",
      name: "Old Name",
      isPlatformAdmin: false,
    };

    expect(
      sessionTokenClaims({
        token,
        update: { username: "new", lastName: null },
      }),
    ).toEqual({ ...token, username: "new", lastName: null });
    expect(
      sessionTokenClaims({
        token,
        update: { firstName: "New", name: "New Name" },
      }),
    ).toEqual({ ...token, firstName: "New", name: "New Name" });
  });

  it("does not let a session update grant the Platform Admin claim", () => {
    const update = { isPlatformAdmin: true } as Parameters<
      typeof sessionTokenClaims
    >[0]["update"];

    expect(
      sessionTokenClaims({ token: { isPlatformAdmin: false }, update })
        .isPlatformAdmin,
    ).toBe(false);
  });

  it("leaves the token's claims alone without a sign-in or update", () => {
    const token = { id: "p", username: "u", isPlatformAdmin: true };

    expect(sessionTokenClaims({ token })).toEqual(token);
  });
});
