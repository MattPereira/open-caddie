import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFixtures } from "@/test/fixtures";
import { canFileProblemReport, fileProblemReport } from "../server";

describe("problem reports against stored Players", () => {
  const fixtures = createFixtures();

  beforeEach(() => {
    vi.stubEnv("PROBLEM_REPORT_GITHUB_TOKEN", "test-token");
    vi.stubEnv("VERCEL_ENV", "production");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("lets a stored Platform Admin file and no one else", async () => {
    const admin = await fixtures.player({ isAdmin: true });
    const player = await fixtures.player();

    expect(await canFileProblemReport(admin.id)).toBe(true);
    expect(await canFileProblemReport(player.id)).toBe(false);
    expect(await canFileProblemReport(crypto.randomUUID())).toBe(false);
  });

  it("files as the stored Player's display name", async () => {
    const admin = await fixtures.player({
      isAdmin: true,
      firstName: "Ada",
      lastName: "Lovelace",
    });
    const fetch = vi.fn(async (_url: string, _init: RequestInit) =>
      Response.json({ html_url: "https://github.com/x/y/issues/1" }),
    );
    vi.stubGlobal("fetch", fetch);

    const result = await fileProblemReport(admin.id, {
      title: "Broken",
      description: "It broke.",
    });

    expect(result).toEqual({
      ok: true,
      url: "https://github.com/x/y/issues/1",
    });
    const body = JSON.parse(String(fetch.mock.calls[0][1].body)).body;
    expect(body).toContain(`**Ada Lovelace** (Player \`${admin.id}\`)`);
  });
});
