import { afterEach, describe, expect, it, vi } from "vitest";

import {
  readDelegateRoundIds,
  writeDelegateRoundIds,
} from "./use-delegate-round-id";

const stubStorage = () => {
  const entries = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => entries.set(key, value),
      removeItem: (key: string) => entries.delete(key),
    },
  });
  return entries;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("delegate round id store", () => {
  it("reads nothing for a Round the player has never chosen for", () => {
    stubStorage();

    expect(readDelegateRoundIds(1)).toBeNull();
  });

  it("round-trips a selection", () => {
    stubStorage();

    writeDelegateRoundIds(1, [7, 9]);

    expect(readDelegateRoundIds(1)).toEqual([7, 9]);
  });

  // Choosing nobody is a choice: were it stored as absence, the play form's
  // prefill would put the player's pairing-mates back on the next reload.
  it("distinguishes choosing nobody from never having chosen", () => {
    stubStorage();

    writeDelegateRoundIds(1, []);

    expect(readDelegateRoundIds(1)).toEqual([]);
  });

  it("keeps each Round's selection separate", () => {
    stubStorage();

    writeDelegateRoundIds(1, [7]);

    expect(readDelegateRoundIds(2)).toBeNull();
  });

  it("reads nothing from a malformed or non-numeric value", () => {
    const entries = stubStorage();
    writeDelegateRoundIds(1, [7]);
    const [key] = [...entries.keys()];

    entries.set(key, "{not json");
    expect(readDelegateRoundIds(1)).toBeNull();

    entries.set(key, '"7"');
    expect(readDelegateRoundIds(1)).toBeNull();
  });

  it("drops ids that are not positive integers", () => {
    const entries = stubStorage();
    writeDelegateRoundIds(1, [7]);
    const [key] = [...entries.keys()];
    entries.set(key, JSON.stringify([7, 0, -3, 1.5, "8", null]));

    expect(readDelegateRoundIds(1)).toEqual([7]);
  });
});
