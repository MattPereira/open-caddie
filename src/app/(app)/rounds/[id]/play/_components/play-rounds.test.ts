import { describe, expect, it } from "vitest";

import { pickPlayRounds } from "./play-rounds";

const eventRounds = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];

describe("pickPlayRounds", () => {
  it("returns the played Round and each scorable Round in the order asked", () => {
    expect(pickPlayRounds(eventRounds, 2, [4, 1])).toEqual({
      round: { id: 2 },
      scorableRounds: [{ id: 4 }, { id: 1 }],
    });
  });

  it("returns no scorable Rounds when asked for none", () => {
    expect(pickPlayRounds(eventRounds, 2, [])).toEqual({
      round: { id: 2 },
      scorableRounds: [],
    });
  });

  it("skips scorable Rounds missing from the event", () => {
    expect(pickPlayRounds(eventRounds, 2, [9, 3])?.scorableRounds).toEqual([
      { id: 3 },
    ]);
  });

  it("returns null when the played Round isn't in the event", () => {
    expect(pickPlayRounds(eventRounds, 9, [1])).toBeNull();
  });
});
