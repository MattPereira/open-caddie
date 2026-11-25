import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPlayerById } from "@/modules/players/server";
import { createFixtures } from "@/test/fixtures";
import { fileBugReport } from "../server";

vi.mock("@/modules/players/server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/modules/players/server")>();
  return { ...actual, getPlayerById: vi.fn(actual.getPlayerById) };
});

const ISSUE_URL = "https://github.com/MattPereira/open-caddie/issues/42";
const REFUSED = { ok: false, error: "You can't report bugs here." };
const REPORT = {
  title: "Scores vanish",
  description: "I entered a score and it disappeared.",
  path: "/rounds/7?tab=scores",
  viewport: 390,
};

function githubReturning(response: () => Response | Promise<Response>) {
  const requests: { url: string; init: RequestInit }[] = [];
  const fetch = vi.fn(
    async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init: init ?? {} });
      return response();
    },
  );
  return { fetch, requests };
}

const github = () =>
  githubReturning(() =>
    Response.json({ html_url: ISSUE_URL }, { status: 201 }),
  );

describe("filing a Bug Report", () => {
  const fixtures = createFixtures();
  let adminId: string;

  beforeEach(async () => {
    vi.stubEnv("PROBLEM_REPORT_GITHUB_TOKEN", "test-token");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv(
      "VERCEL_GIT_COMMIT_SHA",
      "9092a35c1f0e4b7d8a6e2f3b4c5d6e7f8a9b0c1d",
    );
    adminId = (
      await fixtures.player({
        isPlatformAdmin: true,
        firstName: "Ada",
        lastName: "Lovelace",
      })
    ).id;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("files one labelled issue on the repo and returns its link", async () => {
    const { fetch, requests } = github();

    const result = await fileBugReport(adminId, REPORT, fetch);

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
      labels: ["live-bug-report"],
      body: [
        `_Bug reported by **Ada Lovelace** (Player \`${adminId}\`) on \`/rounds/7?tab=scores\`_`,
        "_`9092a35` · viewport 390px_",
        "",
        "---",
        "",
        "I entered a score and it disappeared.",
      ].join("\n"),
    });
  });

  it("uses the global fetch when none is passed", async () => {
    const { fetch, requests } = github();
    vi.stubGlobal("fetch", fetch);

    expect(await fileBugReport(adminId, REPORT)).toEqual({
      ok: true,
      url: ISSUE_URL,
    });
    expect(requests).toHaveLength(1);
  });

  describe("page context", () => {
    async function sentHeader(context: { path?: unknown; viewport?: unknown }) {
      const { fetch, requests } = github();
      const result = await fileBugReport(
        adminId,
        { ...REPORT, ...context } as typeof REPORT,
        fetch,
      );
      expect(result.ok).toBe(true);
      const body: string = JSON.parse(String(requests[0].init.body)).body;
      return body.split("\n").slice(0, 2).join("\n");
    }

    it.each([
      { when: "missing", path: undefined },
      { when: "relative", path: "rounds/7" },
      { when: "not a string", path: 42 },
      { when: "over 2,000 characters", path: `/${"x".repeat(2000)}` },
    ])("shows an invalid path ($when) as unknown", async ({ path }) => {
      expect(await sentHeader({ path })).toBe(
        `_Bug reported by **Ada Lovelace** (Player \`${adminId}\`) on \`unknown\`_\n_\`9092a35\` · viewport 390px_`,
      );
    });

    it("keeps a path of exactly 2,000 characters", async () => {
      const path = `/${"x".repeat(1999)}`;
      expect(await sentHeader({ path })).toContain(`on \`${path}\`_`);
    });

    it("strips backticks from the path", async () => {
      expect(await sentHeader({ path: "/rounds/`7`?q=``a" })).toContain(
        "on `/rounds/7?q=a`_",
      );
    });

    it.each([
      { when: "missing", viewport: undefined },
      { when: "zero", viewport: 0 },
      { when: "negative", viewport: -390 },
      { when: "fractional", viewport: 390.5 },
      { when: "over 10,000", viewport: 10_001 },
      { when: "a string", viewport: "390" },
    ])("shows an invalid viewport ($when) as unknown", async ({ viewport }) => {
      expect(await sentHeader({ viewport })).toBe(
        `_Bug reported by **Ada Lovelace** (Player \`${adminId}\`) on \`/rounds/7?tab=scores\`_\n_\`9092a35\` · viewport unknown_`,
      );
    });

    it.each([1, 10_000])("keeps a viewport of %ipx", async (viewport) => {
      expect(await sentHeader({ viewport })).toContain(
        `viewport ${viewport}px_`,
      );
    });

    it("shows a missing commit as unknown", async () => {
      vi.stubEnv("VERCEL_GIT_COMMIT_SHA", undefined);
      expect(await sentHeader({})).toContain("_`unknown` · viewport 390px_");
    });
  });

  describe("errors from the reporter's browser", () => {
    const ERROR = {
      at: "2026-11-22T18:00:00.000Z",
      kind: "boundary",
      message: "Error: An error occurred in the Server Components render.",
      digest: "1234567890",
    };

    async function sentBody(clientErrors: unknown) {
      const { fetch, requests } = github();
      const result = await fileBugReport(
        adminId,
        { ...REPORT, clientErrors },
        fetch,
      );
      expect(result.ok).toBe(true);
      return JSON.parse(String(requests[0].init.body)).body as string;
    }

    it("lists them under the description, oldest first, with any digest", async () => {
      const body = await sentBody([
        ERROR,
        {
          at: "2026-11-22T18:00:01.000Z",
          kind: "console",
          message: "Warning: x",
        },
      ]);

      expect(body).toMatch(
        new RegExp(
          [
            "I entered a score and it disappeared.",
            "",
            "---",
            "",
            "\\*\\*Errors in the reporter's browser\\*\\*, oldest first:",
            "",
            "```text",
            "2026-11-22T18:00:00.000Z boundary digest 1234567890: Error: An error occurred in the Server Components render\\.",
            "2026-11-22T18:00:01.000Z console: Warning: x",
            "```$",
          ].join("\n"),
        ),
      );
    });

    it("fences them longer than any backtick run inside", async () => {
      const body = await sentBody([{ ...ERROR, message: "a ```` b" }]);

      expect(body).toContain("`````text\n");
      expect(body).toMatch(/\n`````$/);
    });

    it.each([
      { when: "missing", clientErrors: undefined },
      { when: "empty", clientErrors: [] },
      { when: "not a list", clientErrors: "boom" },
      { when: "malformed", clientErrors: [{ ...ERROR, kind: "other" }] },
      {
        when: "over 20",
        clientErrors: Array.from({ length: 21 }, () => ERROR),
      },
    ])(
      "leaves the section out when they are $when",
      async ({ clientErrors }) => {
        expect(await sentBody(clientErrors)).not.toContain("Errors in");
      },
    );
  });

  describe("refuses without calling GitHub", () => {
    it.each([
      { when: "no token is set", env: { PROBLEM_REPORT_GITHUB_TOKEN: "" } },
      { when: "not in production", env: { VERCEL_ENV: "preview" } },
    ])("when $when", async ({ env }) => {
      for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
      const { fetch, requests } = github();

      expect(await fileBugReport(adminId, REPORT, fetch)).toEqual(REFUSED);
      expect(requests).toHaveLength(0);
    });

    it("when the Player is not a Platform Admin", async () => {
      const player = await fixtures.player();
      const { fetch, requests } = github();

      expect(await fileBugReport(player.id, REPORT, fetch)).toEqual(REFUSED);
      expect(requests).toHaveLength(0);
    });

    it("when the Player does not exist", async () => {
      const { fetch, requests } = github();

      expect(await fileBugReport(crypto.randomUUID(), REPORT, fetch)).toEqual(
        REFUSED,
      );
      expect(requests).toHaveLength(0);
    });

    it("when signed out", async () => {
      const { fetch, requests } = github();

      expect(await fileBugReport(null, REPORT, fetch)).toEqual(REFUSED);
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
        const { fetch, requests } = github();

        const result = await fileBugReport(
          adminId,
          { ...REPORT, [field]: value },
          fetch,
        );

        expect(result).toEqual({ ok: false, error });
        expect(requests).toHaveLength(0);
      },
    );

    it("files the trimmed title and description at their maximum lengths", async () => {
      const { fetch, requests } = github();
      const title = "t".repeat(200);
      const description = "d".repeat(10_000);

      const result = await fileBugReport(
        adminId,
        { title: `  ${title}  `, description: `\n${description}\n` },
        fetch,
      );

      expect(result.ok).toBe(true);
      const sent = JSON.parse(String(requests[0].init.body));
      expect(sent.title).toBe(title);
      expect(sent.body).toMatch(new RegExp(`---\\n\\n${description}$`));
    });
  });

  it("names the stored Player even when the form claims to be someone else", async () => {
    const { fetch, requests } = github();

    await fileBugReport(
      adminId,
      { ...REPORT, name: "Mallory", playerId: "someone-else" } as typeof REPORT,
      fetch,
    );

    const sent = JSON.parse(String(requests[0].init.body));
    expect(sent.body).toContain(`**Ada Lovelace** (Player \`${adminId}\`)`);
    expect(sent.body).not.toContain("Mallory");
    expect(sent.body).not.toContain("someone-else");
  });

  describe("returns an error instead of throwing", () => {
    it("when the Player lookup throws", async () => {
      vi.mocked(getPlayerById).mockRejectedValueOnce(new Error("db down"));
      const { fetch, requests } = github();

      expect(await fileBugReport(adminId, REPORT, fetch)).toEqual({
        ok: false,
        error: "Couldn't file the report. Try again later.",
      });
      expect(requests).toHaveLength(0);
    });

    it("when GitHub refuses", async () => {
      const { fetch } = githubReturning(() =>
        Response.json({ message: "Bad credentials" }, { status: 401 }),
      );

      expect(await fileBugReport(adminId, REPORT, fetch)).toEqual({
        ok: false,
        error: "GitHub refused the report (401). Try again later.",
      });
    });

    it("when GitHub can't be reached", async () => {
      const { fetch } = githubReturning(() => {
        throw new TypeError("fetch failed");
      });

      expect(await fileBugReport(adminId, REPORT, fetch)).toEqual({
        ok: false,
        error: "Couldn't reach GitHub. Try again later.",
      });
    });

    it.each([
      {
        when: "the success body is not JSON",
        response: () => new Response("<html>", { status: 201 }),
      },
      {
        when: "the issue link is missing",
        response: () => Response.json({}, { status: 201 }),
      },
      {
        when: "the success body is null",
        response: () => Response.json(null, { status: 201 }),
      },
      {
        when: "the issue link is not a string",
        response: () => Response.json({ html_url: 42 }, { status: 201 }),
      },
      {
        when: "the issue link is empty",
        response: () => Response.json({ html_url: "" }, { status: 201 }),
      },
    ])("when $when", async ({ response }) => {
      const { fetch } = githubReturning(response);

      expect(await fileBugReport(adminId, REPORT, fetch)).toEqual({
        ok: false,
        error:
          "GitHub didn't return a link to the report. Check GitHub before trying again.",
      });
    });
  });
});
