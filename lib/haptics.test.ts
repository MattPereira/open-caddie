import { afterEach, describe, expect, it, vi } from "vitest";

import { haptic, type HapticKind } from "./haptics";

const stubVibrate = (impl?: () => boolean) => {
  const vibrate = vi.fn(impl ?? (() => true));
  vi.stubGlobal("navigator", { vibrate });
  return vibrate;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("haptic", () => {
  const cases: [HapticKind, number | number[]][] = [
    ["tick", 10],
    ["commit", [0, 25]],
    ["clear", [0, 15, 40, 15]],
    ["error", [0, 60, 60, 60]],
  ];

  it.each(cases)("emits the %s pattern", (kind, pattern) => {
    const vibrate = stubVibrate();

    haptic(kind);

    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(pattern);
  });

  it("no-ops without throwing when the API is missing", () => {
    vi.stubGlobal("navigator", {});

    expect(() => haptic("commit")).not.toThrow();
  });

  it("no-ops without throwing when there is no navigator at all", () => {
    vi.stubGlobal("navigator", undefined);

    expect(() => haptic("commit")).not.toThrow();
  });
});
