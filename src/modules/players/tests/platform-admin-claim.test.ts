import { describe, expect, it } from "vitest";

import { platformAdminClaim } from "@/modules/players";

describe("platformAdminClaim", () => {
  it("reads the isPlatformAdmin claim when the token has it", () => {
    expect(platformAdminClaim({ isPlatformAdmin: true })).toBe(true);
    expect(platformAdminClaim({ isPlatformAdmin: false })).toBe(false);
  });

  it("prefers isPlatformAdmin over a disagreeing old claim", () => {
    expect(platformAdminClaim({ isPlatformAdmin: false, isAdmin: true })).toBe(
      false,
    );
    expect(platformAdminClaim({ isPlatformAdmin: true, isAdmin: false })).toBe(
      true,
    );
  });

  it("falls back to the old isAdmin claim on a token minted before expand", () => {
    expect(platformAdminClaim({ isAdmin: true })).toBe(true);
    expect(platformAdminClaim({ isAdmin: false })).toBe(false);
  });

  it("is false for a token with neither claim", () => {
    expect(platformAdminClaim({})).toBe(false);
    expect(platformAdminClaim({ isAdmin: "true" })).toBe(false);
  });
});
