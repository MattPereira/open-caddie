import { describe, expect, it } from "vitest";
import { courseHandleFromName } from "../handle";

describe("courseHandleFromName", () => {
  it("lowercases and joins words with hyphens", () => {
    expect(courseHandleFromName("Pebble Beach Golf Links")).toBe("pebble-beach-golf-links");
  });

  it("strips accents", () => {
    expect(courseHandleFromName("Club de Golf Señorío")).toBe("club-de-golf-senorio");
  });

  it("collapses runs of non-alphanumerics into one hyphen", () => {
    expect(courseHandleFromName("St. Andrews — Old Course #1")).toBe("st-andrews-old-course-1");
  });

  it("trims leading and trailing hyphens", () => {
    expect(courseHandleFromName("  ...Torrey Pines!!  ")).toBe("torrey-pines");
  });

  it("caps at 50 characters", () => {
    expect(courseHandleFromName("a".repeat(80))).toHaveLength(50);
  });
});
