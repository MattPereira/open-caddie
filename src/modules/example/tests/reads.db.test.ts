import { describe, expect, it } from "vitest";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { createRoundFixtures } from "@/test/fixtures/rounds";
import { getPlayerCount } from "../server";

describe("getPlayerCount", () => {
  const fixtures = createRoundFixtures(db, schema);

  it("counts every Player", async () => {
    const before = await getPlayerCount();
    await fixtures.player();
    await fixtures.player();
    expect(await getPlayerCount()).toBe(before + 2);
  });
});
