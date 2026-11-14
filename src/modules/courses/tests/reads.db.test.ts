import { describe, expect, it } from "vitest";

import { db } from "@/db";
import * as schema from "@/db/schema";
import * as courses from "../index";

describe("Course reads", () => {
  type TeeSetup = {
    name: string;
    rating?: string;
    slope?: number;
    sortOrder?: number;
    yardages?: Record<number, number>;
  };

  // Holes are inserted last-to-first so ordering comes from the read, not insertion.
  async function courseWith({
    tees = [],
    imgUrl = null,
    scorecardImgUrl = null,
  }: { tees?: TeeSetup[]; imgUrl?: string | null; scorecardImgUrl?: string | null } = {}) {
    const suffix = crypto.randomUUID();
    const [course] = await db
      .insert(schema.courses)
      .values({ handle: `course-${suffix}`, name: `Course ${suffix}`, imgUrl, scorecardImgUrl })
      .returning();
    await db.insert(schema.courseHoles).values(
      Array.from({ length: 18 }, (_, index) => {
        const hole = 18 - index;
        return { courseId: course.id, hole, par: hole % 6 === 0 ? 5 : 4, handicap: 19 - hole };
      }),
    );
    const teeIds: Record<string, number> = {};
    for (const tee of tees) {
      const [created] = await db
        .insert(schema.courseTees)
        .values({
          courseId: course.id,
          name: tee.name,
          rating: tee.rating ?? "70",
          slope: tee.slope ?? 120,
          sortOrder: tee.sortOrder ?? 0,
        })
        .returning();
      teeIds[tee.name] = created.id;
      const yardages = Object.entries(tee.yardages ?? {}).map(([hole, yards]) => ({
        teeId: created.id,
        hole: Number(hole),
        yards,
      }));
      if (yardages.length > 0) await db.insert(schema.teeYardages).values(yardages);
    }
    return { course, teeIds };
  }

  const expectedHoles = Array.from({ length: 18 }, (_, index) => {
    const hole = index + 1;
    return { hole, par: hole % 6 === 0 ? 5 : 4, handicap: 19 - hole };
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
        tees: [{ name: "Blue", yardages: { 1: 410, 9: 520, 18: 385 } }, { name: "Red" }],
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

    it("orders tees by sort order, then by id", async () => {
      const { course } = await courseWith({
        tees: [
          { name: "Red", sortOrder: 2 },
          { name: "Black", sortOrder: 0 },
          { name: "White", sortOrder: 1 },
          { name: "Gold", sortOrder: 1 },
        ],
      });
      const tees = (await read(course.handle))?.tees ?? [];
      expect(tees.map((tee) => tee.name)).toEqual(["Black", "White", "Gold", "Red"]);
    });

    it("returns each tee's details", async () => {
      const { course, teeIds } = await courseWith({
        tees: [{ name: "Blue", rating: "71.3", slope: 131, sortOrder: 0 }],
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
          { name: "White", rating: "69.1", slope: 118, sortOrder: 1 },
          { name: "Black", rating: "74.2", slope: 139, sortOrder: 0 },
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
      const { course } = await courseWith({
        imgUrl: "https://example.com/course.webp",
        scorecardImgUrl: "https://example.com/card.webp",
      });
      expect(await courses.getCourseForEdit(course.handle)).toMatchObject({
        id: course.id,
        handle: course.handle,
        name: course.name,
        imgUrl: "https://example.com/course.webp",
        scorecardImgUrl: "https://example.com/card.webp",
      });
    });
  });

  describe("getCoursesWithTees", () => {
    it("lists tees in order with total yards, or null when none are saved", async () => {
      const { course, teeIds } = await courseWith({
        tees: [
          { name: "White", sortOrder: 1 },
          { name: "Blue", sortOrder: 0, yardages: { 1: 400, 2: 350, 18: 500 } },
        ],
      });
      const listed = (await courses.getCoursesWithTees()).find((c) => c.handle === course.handle);
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
      const listed = (await courses.getCoursesWithTees()).find((c) => c.handle === course.handle);
      expect(listed?.tees).toEqual([]);
    });
  });
});
