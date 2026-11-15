import { describe, expect, it } from "vitest";

import { greet } from "../index";

describe("example module", () => {
  it("greets by name", () => {
    expect(greet("Ada")).toBe("Hello, Ada!");
  });

  it("falls back for a blank name", () => {
    expect(greet("  ")).toBe("Hello, stranger!");
  });
});
