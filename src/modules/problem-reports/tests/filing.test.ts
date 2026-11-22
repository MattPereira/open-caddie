import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createProblemReports, isProblemReportingConfigured } from "../server";

type Reporter = { id: string; name: string; isPlatformAdmin: boolean };

const ADMIN: Reporter = {
  id: "admin-1",
  name: "Ada Lovelace",
  isPlatformAdmin: true,
};
const ISSUE_URL = "https://github.com/MattPereira/open-caddie/issues/42";
const REPORT = {
  title: "Scores vanish",
  description: "I entered a score and it disappeared.",
};

function setup({ reporters = [ADMIN] }: { reporters?: Reporter[] } = {}) {
  const requests: { url: string; init: RequestInit }[] = [];
  const fetch = vi.fn(
    async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init: init ?? {} });
      return Response.json({ html_url: ISSUE_URL }, { status: 201 });
    },
  );
  const problemReports = createProblemReports({
    fetch,
    findReporter: async (playerId) =>
      reporters.find((reporter) => reporter.id === playerId) ?? null,
  });
  return { problemReports, requests };
}

describe("filing a problem report", () => {
  beforeEach(() => {
    vi.stubEnv("PROBLEM_REPORT_GITHUB_TOKEN", "test-token");
    vi.stubEnv("VERCEL_ENV", "production");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("files one labelled issue on the repo and returns its link", async () => {
    const { problemReports, requests } = setup();

    const result = await problemReports.file(ADMIN.id, REPORT);

    expect(result).toEqual({ ok: true, url: ISSUE_URL });
    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request.url).toBe(
      "https://api.github.com/repos/MattPereira/open-caddie/issues",
    );
    expect(request.init.method).toBe("POST");
    const headers = new Headers(request.init.headers);
    expect(headers.get("authorization")).toBe("Bearer test-token");
    expect(headers.get("accept")).toBe("application/vnd.github+json");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-github-api-version")).toBe("2022-11-28");
    expect(JSON.parse(String(request.init.body))).toEqual({
      title: "Scores vanish",
      labels: ["agent:explore"],
      body: "_Problem reported by **Ada Lovelace** (Player `admin-1`)_\n\n---\n\nI entered a score and it disappeared.",
    });
  });

  it("lets a Platform Admin file when the token is set in production", async () => {
    const { problemReports } = setup();

    expect(await problemReports.canFile(ADMIN.id)).toBe(true);
  });

  describe("refuses without calling GitHub", () => {
    const PLAYER: Reporter = {
      id: "player-1",
      name: "Grace Hopper",
      isPlatformAdmin: false,
    };

    it.each([
      {
        when: "no token is set",
        env: { PROBLEM_REPORT_GITHUB_TOKEN: "" },
        playerId: ADMIN.id,
      },
      {
        when: "not in production",
        env: { VERCEL_ENV: "preview" },
        playerId: ADMIN.id,
      },
      { when: "the Player is not a Platform Admin", playerId: PLAYER.id },
      { when: "the Player does not exist", playerId: "ghost" },
      { when: "signed out", playerId: null },
    ])("when $when", async ({ env = {}, playerId }) => {
      for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
      const { problemReports, requests } = setup({
        reporters: [ADMIN, PLAYER],
      });

      expect(await problemReports.canFile(playerId)).toBe(false);
      expect(await problemReports.file(playerId, REPORT)).toEqual({
        ok: false,
        error: "You can't report problems here.",
      });
      expect(requests).toHaveLength(0);
    });
  });

  describe("validation", () => {
    it.each([
      { field: "title", value: "   ", error: "Title is required." },
      {
        field: "title",
        value: "x".repeat(201),
        error: "Title must be at most 200 characters.",
      },
      {
        field: "description",
        value: " \n ",
        error: "Describe what went wrong.",
      },
      {
        field: "description",
        value: "x".repeat(10_001),
        error: "Description must be at most 10,000 characters.",
      },
    ])(
      "rejects $field of length $value.length without calling GitHub",
      async ({ field, value, error }) => {
        const { problemReports, requests } = setup();

        const result = await problemReports.file(ADMIN.id, {
          ...REPORT,
          [field]: value,
        });

        expect(result).toEqual({ ok: false, error });
        expect(requests).toHaveLength(0);
      },
    );

    it("files the trimmed title and description at their maximum lengths", async () => {
      const { problemReports, requests } = setup();
      const title = "t".repeat(200);
      const description = "d".repeat(10_000);

      const result = await problemReports.file(ADMIN.id, {
        title: `  ${title}  `,
        description: `\n${description}\n`,
      });

      expect(result.ok).toBe(true);
      const sent = JSON.parse(String(requests[0].init.body));
      expect(sent.title).toBe(title);
      expect(sent.body).toMatch(new RegExp(`---\\n\\n${description}$`));
    });
  });

  it("names the stored Player even when the form claims to be someone else", async () => {
    const { problemReports, requests } = setup();

    await problemReports.file(ADMIN.id, {
      ...REPORT,
      name: "Mallory",
      playerId: "someone-else",
    } as typeof REPORT);

    const sent = JSON.parse(String(requests[0].init.body));
    expect(sent.body).toContain("**Ada Lovelace** (Player `admin-1`)");
    expect(sent.body).not.toContain("Mallory");
    expect(sent.body).not.toContain("someone-else");
  });

  describe("when GitHub fails", () => {
    it("reports an error response", async () => {
      const problemReports = createProblemReports({
        fetch: async () =>
          Response.json({ message: "Bad credentials" }, { status: 401 }),
        findReporter: async () => ADMIN,
      });

      expect(await problemReports.file(ADMIN.id, REPORT)).toEqual({
        ok: false,
        error: "GitHub refused the report (401). Try again later.",
      });
    });

    it("reports a network failure", async () => {
      const problemReports = createProblemReports({
        fetch: async () => {
          throw new TypeError("fetch failed");
        },
        findReporter: async () => ADMIN,
      });

      expect(await problemReports.file(ADMIN.id, REPORT)).toEqual({
        ok: false,
        error: "Couldn't reach GitHub. Try again later.",
      });
    });
  });

  it("is configured only with a token in production", () => {
    expect(isProblemReportingConfigured()).toBe(true);
    vi.stubEnv("VERCEL_ENV", "development");
    expect(isProblemReportingConfigured()).toBe(false);
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("PROBLEM_REPORT_GITHUB_TOKEN", undefined);
    expect(isProblemReportingConfigured()).toBe(false);
  });
});
