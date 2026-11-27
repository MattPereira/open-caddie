import { describe, expect, it } from "vitest";

import { formatSeededRoutes, scoringProgress, seedRoutesFile } from "./routes";

describe("seedRoutesFile", () => {
  it("defaults to the path the agent docs name, unless overridden", () => {
    expect(seedRoutesFile({})).toBe("/tmp/seed-routes.txt");
    expect(seedRoutesFile({ SEED_ROUTES_FILE: "/x/routes.txt" })).toBe(
      "/x/routes.txt",
    );
  });
});

describe("scoringProgress", () => {
  it("names an Event by how many holes are scored", () => {
    expect(scoringProgress(0)).toBe("upcoming, no scores");
    expect(scoringProgress(1)).toBe("live, 1 holes scored");
    expect(scoringProgress(17)).toBe("live, 17 holes scored");
    expect(scoringProgress(18)).toBe("completed");
  });
});

describe("formatSeededRoutes", () => {
  it("prints one line per route, descriptions aligned", () => {
    expect(
      formatSeededRoutes([
        { path: "/clubs/a", shows: "a Club" },
        { path: "/rounds/12/play", shows: "a Round's play page" },
      ]),
    ).toBe(
      "/clubs/a         a Club\n" + "/rounds/12/play  a Round's play page\n",
    );
  });
});
