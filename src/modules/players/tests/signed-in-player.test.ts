import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => auth() }));

// Never connected to: getSignedInPlayer reads only the session.
process.env.DATABASE_URL ??= "postgres://unused@localhost/unused";

const { getSignedInPlayer } = await import("../index");

function signedIn(identity: Record<string, unknown>) {
  // eslint-disable-next-line local/player-domain-term -- Auth.js session shape
  auth.mockResolvedValue({ user: identity });
}

describe("getSignedInPlayer", () => {
  beforeEach(() => auth.mockReset());

  it("is null when nobody is signed in", async () => {
    auth.mockResolvedValue(null);
    expect(await getSignedInPlayer()).toBeNull();
  });

  it("is null when the session carries no Player id", async () => {
    signedIn({ email: "a@example.com" });
    expect(await getSignedInPlayer()).toBeNull();
  });

  it("is the session's Player, including Admin, when signed in", async () => {
    signedIn({ id: "p1", username: "ann", isAdmin: true, email: "a@example.com" });
    expect(await getSignedInPlayer()).toMatchObject({
      id: "p1",
      username: "ann",
      isAdmin: true,
    });
  });
});
