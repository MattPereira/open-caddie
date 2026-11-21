import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFirstPlatformAdmin } from "@/modules/players/server";
import { createSignInLinkForEmail } from "./sign-in-link";

describe("createSignInLinkForEmail", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", "test-secret");
  });

  it("links a Player's email to the email sign-in callback", async () => {
    await createFirstPlatformAdmin({
      email: "admin@example.com",
      firstName: "Pat",
      lastName: "Admin",
    });

    const result = await createSignInLinkForEmail({
      email: " Admin@Example.com ",
      origin: "http://localhost:3000",
    });

    if (!result.ok) throw new Error(result.error);
    const url = new URL(result.url);
    expect(url.origin).toBe("http://localhost:3000");
    expect(url.pathname).toBe("/api/auth/callback/resend");
    expect(url.searchParams.get("email")).toBe("admin@example.com");
    expect(url.searchParams.get("token")).toMatch(/^[0-9a-f]{32}$/);
  });

  it("refuses an email no Player has", async () => {
    const result = await createSignInLinkForEmail({
      email: "nobody@example.com",
      origin: "http://localhost:3000",
    });

    expect(result).toEqual({
      ok: false,
      error: "No Player has the email nobody@example.com.",
    });
  });
});
