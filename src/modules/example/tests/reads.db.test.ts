import { describe, expect, it } from "vitest";

import { getDatabaseName } from "../server";

describe("getDatabaseName", () => {
  it("names the connected database", async () => {
    expect(await getDatabaseName()).toMatch(/\S/);
  });
});
