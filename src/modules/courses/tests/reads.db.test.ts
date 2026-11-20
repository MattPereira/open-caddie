import { describe, expect, it } from "vitest";

import { HOLE_COUNT } from "@/modules/courses";
import { createFixtures } from "@/test/fixtures";
import * as courses from "../server";
import { importedCourse } from "./scorecard-import-fixtures";

describe("Course reads", () => {
  const fixtures = createFixtures();

  type TeeSetup = {
    name: string;
    rating?: string;
    slope?: number;
    yardages?: Record<number, number>;
  };

  function teeInput(tee: TeeSetup, sortOrder: number) {
    return {
      name: tee.name,
      color: "",
      rating: tee.rating ?? "70",
      slope: tee.slope ?? 120,
      yardages: Array.from(
        { length: HOLE_COUNT },
        (_, index) => tee.yardages?.[index + 1] ?? ("" as const),
      ),
      sortOrder,
    };
  }

  // Tees are stored in the order given. Holes are given last-to-first so
  // ordering comes from the read, not the write.
  async function courseWith({
    tees = [],
    imgUrl = "",
  }: { tees?: TeeSetup[]; imgUrl?: string } = {}) {
    const suffix = crypto.randomUUID();
    const values = {
      handle: `course-${suffix}`,
      name: `Course ${suffix}`,
      imgUrl,
      tees: tees.map(teeInput),
      holes: Array.from({ length: HOLE_COUNT }, (_, index) => {
        const hole = HOLE_COUNT - index;
        return {
          hole,
          par: hole % 6 === 0 ? 5 : 4,
          handicap: HOLE_COUNT + 1 - hole,
        };
      }),
    };
    const created = await courses.createCourse(await fixtures.admin(), values);
    if (!created.ok) throw new Error(created.error);
    const stored = await courses.getCourseForEdit(values.handle);
    const teeIds = Object.fromEntries(
      (stored?.tees ?? []).map((tee) => [tee.name, tee.id]),
    );
    return {
      course: { id: created.id, handle: values.handle, name: values.name },
      teeIds,
    };
  }

  const expectedHoles = Array.from({ length: HOLE_COUNT }, (_, index) => {
    const hole = index + 1;
    return {
      hole,
      par: hole % 6 === 0 ? 5 : 4,
      handicap: HOLE_COUNT + 1 - hole,
    };
  });

  describe.each([
    ["getCourseByHandle", courses.getCourseByHandle],
    ["getCourseForEdit", courses.getCourseForEdit],
  ])("%s", (_, read) => {
    it("returns undefined for an unknown handle", async () => {
      expect(await read(`missing-${crypto.randomUUID()}`)).toBeUndefined();
    });

    it("returns holes 1 through 18 in order with par and handicap", async () => {
      const { course } = await courseWith();
      expect((await read(course.handle))?.holes).toEqual(expectedHoles);
    });

    it("returns 18 yardages per tee, null where none is saved", async () => {
      const { course } = await courseWith({
        tees: [
          { name: "Blue", yardages: { 1: 410, 9: 520, 18: 385 } },
          { name: "Red" },
        ],
      });
      const tees = (await read(course.handle))?.tees ?? [];
      const expected = Array<number | null>(18).fill(null);
      expected[0] = 410;
      expected[8] = 520;
      expected[17] = 385;
      expect(tees.map((tee) => [tee.name, tee.yardages])).toEqual([
        ["Blue", expected],
        ["Red", Array(18).fill(null)],
      ]);
    });

    it("orders tees by sort order, not by when they were added", async () => {
      const { course, teeIds } = await courseWith({
        tees: [{ name: "Red" }, { name: "White" }],
      });
      const edit = await courses.getCourseForEdit(course.handle);
      if (!edit) throw new Error("course missing");
      const reordered = await courses.updateCourse(await fixtures.admin(), {
        id: course.id,
        handle: course.handle,
        name: course.name,
        imgUrl: "",
        tees: [
          teeInput({ name: "Black" }, 0),
          { ...teeInput({ name: "White" }, 1), id: teeIds.White },
          { ...teeInput({ name: "Red" }, 2), id: teeIds.Red },
        ],
        holes: edit.holes,
      });
      expect(reordered.ok).toBe(true);
      const tees = (await read(course.handle))?.tees ?? [];
      expect(tees.map((tee) => tee.name)).toEqual(["Black", "White", "Red"]);
    });

    it("returns each tee's details", async () => {
      const { course, teeIds } = await courseWith({
        tees: [{ name: "Blue", rating: "71.3", slope: 131 }],
      });
      const [tee] = (await read(course.handle))?.tees ?? [];
      expect(tee).toEqual({
        id: teeIds.Blue,
        name: "Blue",
        color: null,
        rating: "71.3",
        slope: 131,
        sortOrder: 0,
        yardages: Array(18).fill(null),
      });
    });
  });

  describe("getCourseByHandle", () => {
    it("takes rating and slope from the first tee", async () => {
      const { course } = await courseWith({
        tees: [
          { name: "Black", rating: "74.2", slope: 139 },
          { name: "White", rating: "69.1", slope: 118 },
        ],
      });
      expect(await courses.getCourseByHandle(course.handle)).toMatchObject({
        id: course.id,
        handle: course.handle,
        name: course.name,
        rating: "74.2",
        slope: 139,
      });
    });

    it("falls back to zero rating and slope without tees", async () => {
      const { course } = await courseWith();
      expect(await courses.getCourseByHandle(course.handle)).toMatchObject({
        rating: "0",
        slope: 0,
        tees: [],
      });
    });
  });

  describe("getCourseForEdit", () => {
    it("includes the course and scorecard images", async () => {
      const course = await importedCourse(fixtures, {
        course: "https://example.com/course.webp",
        scorecard: "https://example.com/card.webp",
      });
      expect(await courses.getCourseForEdit(course.handle)).toMatchObject({
        id: course.id,
        handle: course.handle,
        name: course.name,
        imgUrl: "https://example.com/course.webp",
        scorecardImgUrl: "https://example.com/card.webp",
      });
    });

    it("has no scorecard image for a course saved without an import", async () => {
      const { course } = await courseWith();
      expect(await courses.getCourseForEdit(course.handle)).toMatchObject({
        scorecardImgUrl: null,
      });
    });
  });

  describe("getCoursesWithTees", () => {
    it("lists tees in order with total yards, or null when none are saved", async () => {
      const { course, teeIds } = await courseWith({
        tees: [
          { name: "Blue", yardages: { 1: 400, 2: 350, 18: 500 } },
          { name: "White" },
        ],
      });
      const listed = (await courses.getCoursesWithTees()).find(
        (c) => c.handle === course.handle,
      );
      expect(listed).toEqual({
        handle: course.handle,
        name: course.name,
        tees: [
          { id: teeIds.Blue, name: "Blue", totalYards: 1250 },
          { id: teeIds.White, name: "White", totalYards: null },
        ],
      });
    });

    it("lists a course without tees", async () => {
      const { course } = await courseWith();
      const listed = (await courses.getCoursesWithTees()).find(
        (c) => c.handle === course.handle,
      );
      expect(listed?.tees).toEqual([]);
    });
  });
});
