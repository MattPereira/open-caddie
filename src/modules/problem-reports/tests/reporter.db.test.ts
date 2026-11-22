import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFixtures } from "@/test/fixtures";
import { isProblemReporter } from "../server";

describe("who may report problems", () => {
  const fixtures = createFixtures();

  beforeEach(() => {
    vi.stubEnv("PROBLEM_REPORT_GITHUB_TOKEN", "test-token");
    vi.stubEnv("VERCEL_ENV", "production");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lets a stored Platform Admin report", async () => {
    const admin = await fixtures.player({ isAdmin: true });

    expect(await isProblemReporter(admin.id)).toBe(true);
  });

  it.each([
    { when: "no token is set", env: { PROBLEM_REPORT_GITHUB_TOKEN: "" } },
    {
      when: "the token is unset",
      env: { PROBLEM_REPORT_GITHUB_TOKEN: undefined },
    },
    { when: "not in production", env: { VERCEL_ENV: "preview" } },
  ])("refuses a Platform Admin when $when", async ({ env }) => {
    const admin = await fixtures.player({ isAdmin: true });
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);

    expect(await isProblemReporter(admin.id)).toBe(false);
  });

  it("refuses a Player who is not a Platform Admin", async () => {
    const player = await fixtures.player();

    expect(await isProblemReporter(player.id)).toBe(false);
  });

  it("refuses an unknown Player and a signed-out visitor", async () => {
    expect(await isProblemReporter(crypto.randomUUID())).toBe(false);
    expect(await isProblemReporter(null)).toBe(false);
  });
});
