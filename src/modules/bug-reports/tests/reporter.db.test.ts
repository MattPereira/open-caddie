import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFixtures } from "@/test/fixtures";
import { isBugReporter } from "../server";

describe("who may file Bug Reports", () => {
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

    expect(await isBugReporter(admin.id)).toBe(true);
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

    expect(await isBugReporter(admin.id)).toBe(false);
  });

  it("refuses a Player who is not a Platform Admin", async () => {
    const player = await fixtures.player();

    expect(await isBugReporter(player.id)).toBe(false);
  });

  it("refuses an unknown Player and a signed-out visitor", async () => {
    expect(await isBugReporter(crypto.randomUUID())).toBe(false);
    expect(await isBugReporter(null)).toBe(false);
  });
});
