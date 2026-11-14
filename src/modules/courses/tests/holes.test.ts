import { describe, expect, it } from "vitest";
import { HOLE_COUNT, HOLE_NUMBERS } from "../holes";

describe("holes", () => {
  it("numbers every hole once, 1 through 18", () => {
    expect(HOLE_COUNT).toBe(18);
    expect(HOLE_NUMBERS).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  });
});
