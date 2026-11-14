import { beforeEach, describe, expect, it, vi } from "vitest";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { createRoundFixtures } from "@/test/fixtures/rounds";
import * as courses from "../index";

const { revalidatePath, updateTag, del } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
  del: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath, updateTag }));
vi.mock("@vercel/blob", () => ({ del }));

const BLOB = "https://abc.public.blob.vercel-storage.com";

describe("Course writes", () => {
  const fixtures = createRoundFixtures(db, schema);
  let admin: Awaited<ReturnType<typeof fixtures.player>>;
  let player: Awaited<ReturnType<typeof fixtures.player>>;

  async function stored(handle: string) {
    return courses.getCourseForEdit(handle);
  }

  async function storedTees(handle: string) {
    return (await stored(handle))?.tees ?? [];
  }

  async function casualRound(courseId: number, teeId: number) {
    const roundPlayer = await fixtures.player();
    await db.insert(schema.rounds).values({
      playerId: roundPlayer.id,
      courseId,
      teeId,
      date: new Date("2026-01-01T00:00:00.000Z"),
    });
  }

  type Course = Awaited<ReturnType<typeof fixtures.course>>["course"];
  type Tee = Awaited<ReturnType<typeof fixtures.course>>["tee"];

  function editOf(
    course: Course,
    tees: Tee[],
    overrides: Partial<courses.CourseUpdateInput> = {},
  ): courses.CourseUpdateInput {
    return {
      id: course.id,
      handle: course.handle,
      name: course.name,
      imgUrl: course.imgUrl ?? "",
      tees: tees.map((tee, index) => ({
        id: tee.id,
        name: tee.name,
        color: tee.color ?? "",
        rating: tee.rating,
        slope: tee.slope,
        yardages: Array.from({ length: 18 }, () => "" as const),
        sortOrder: index,
      })),
      holes: Array.from({ length: 18 }, (_, index) => ({
        hole: index + 1,
        par: 4,
        handicap: index + 1,
      })),
      ...overrides,
    };
  }

  function refreshed() {
    const calls = revalidatePath.mock.calls as unknown as string[][];
    return [...new Set(calls.map((call) => call.join(" ")))].sort();
  }

  function coursePaths(...handles: string[]) {
    return [
      "/clubs/[handle] page",
      "/courses",
      ...handles.flatMap((handle) => [`/courses/${handle}`, `/courses/${handle}/edit`]),
    ].sort();
  }

  beforeEach(async () => {
    admin = await fixtures.player({ isAdmin: true });
    player = await fixtures.player();
    revalidatePath.mockClear();
    updateTag.mockClear();
    del.mockReset();
  });

  describe("tee helpers", () => {
    it("finds a course id by handle, or null", async () => {
      const { course } = await fixtures.course();
      expect(await courses.getCourseIdByHandle(course.handle)).toBe(course.id);
      expect(await courses.getCourseIdByHandle(`missing-${crypto.randomUUID()}`)).toBeNull();
    });

    it("knows whether a tee belongs to a course", async () => {
      const a = await fixtures.course();
      const b = await fixtures.course();
      expect(await courses.isTeeForCourse(a.tee.id, a.course.id)).toBe(true);
      expect(await courses.isTeeForCourse(b.tee.id, a.course.id)).toBe(false);
    });
  });

  describe("updateCourse", () => {
    it("refuses a Player who isn't a Platform Admin", async () => {
      const { course, tee } = await fixtures.course();
      const result = await courses.updateCourse(
        player.id,
        editOf(course, [tee], { name: "Renamed" }),
      );
      expect(result).toEqual({ ok: false, error: expect.stringMatching(/Platform Admin/) });
      expect((await stored(course.handle))?.name).toBe(course.name);
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("saves the course, its tees, yardages and holes", async () => {
      const { course, tee } = await fixtures.course();
      const input = editOf(course, [tee], { name: "New Name" });
      input.tees[0] = {
        ...input.tees[0],
        name: "Black",
        color: " black ",
        slope: 130,
        yardages: input.tees[0].yardages.map((_, i) => (i === 0 ? 420 : "")),
      };
      input.tees.push({
        name: "Red",
        color: "",
        rating: "68.5",
        slope: 110,
        yardages: Array.from({ length: 18 }, () => 300),
        sortOrder: 1,
      });
      input.holes[0] = { hole: 1, par: 5, handicap: 1 };

      const result = await courses.updateCourse(admin.id, input);

      expect(result).toEqual({ ok: true, handle: course.handle, renamed: false });
      const saved = await stored(course.handle);
      expect(saved?.name).toBe("New Name");
      expect(
        saved?.tees.map((t) => [t.id === tee.id, t.name, t.color, t.rating, t.slope, t.sortOrder]),
      ).toEqual([
        [true, "Black", "black", tee.rating, 130, 0],
        [false, "Red", null, "68.5", 110, 1],
      ]);
      expect(saved?.tees[0].yardages).toEqual([420, ...Array(17).fill(null)]);
      expect(saved?.tees[1].yardages).toEqual(Array(18).fill(300));
      expect(saved?.holes).toEqual(input.holes);
      expect(updateTag).toHaveBeenCalledWith("home-events");
      expect(refreshed()).toEqual(coursePaths(course.handle));
    });

    it("removes a tee nobody has used", async () => {
      const { course, tee } = await fixtures.course();
      await fixtures.tee(course.id);
      const result = await courses.updateCourse(admin.id, editOf(course, [tee]));
      expect(result.ok).toBe(true);
      expect((await storedTees(course.handle)).map((t) => t.id)).toEqual([tee.id]);
    });

    it("refuses removing tees used by Tournaments or Rounds, with counts per tee", async () => {
      const t = await fixtures.tournament();
      await fixtures.tournamentPlayer(t);
      const keep = await fixtures.tee(t.course.id, "Keep");
      const casualTee = await fixtures.tee(t.course.id, "Casual");
      await casualRound(t.course.id, casualTee.id);
      await casualRound(t.course.id, casualTee.id);

      const result = await courses.updateCourse(admin.id, editOf(t.course, [keep]));

      expect(result).toEqual({
        ok: false,
        error: expect.stringContaining("Cannot remove tees in use"),
      });
      if (result.ok) return;
      expect(result.error).toContain("Blue: 1 tournament(s)");
      expect(result.error).toContain("Blue: 1 round(s)");
      expect(result.error).toContain("Casual: 2 round(s)");
      expect(await storedTees(t.course.handle)).toHaveLength(3);
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("refuses a handle another course already has", async () => {
      const { course, tee } = await fixtures.course();
      const other = await fixtures.course();
      const result = await courses.updateCourse(
        admin.id,
        editOf(course, [tee], { handle: other.course.handle, name: "Renamed" }),
      );
      expect(result).toEqual({
        ok: false,
        error: "A course or tee with that name already exists.",
      });
      expect((await stored(course.handle))?.name).toBe(course.name);
    });

    it("refuses a new tee named like an existing one", async () => {
      const { course, tee } = await fixtures.course();
      const input = editOf(course, [tee]);
      input.tees.push({ ...input.tees[0], id: undefined, sortOrder: 1 });
      const result = await courses.updateCourse(admin.id, input);
      expect(result).toEqual({
        ok: false,
        error: "A course or tee with that name already exists.",
      });
      expect(await storedTees(course.handle)).toHaveLength(1);
    });

    it("refuses a course that doesn't exist", async () => {
      const { course, tee } = await fixtures.course();
      const result = await courses.updateCourse(
        admin.id,
        editOf(course, [tee], { id: 2_000_000_000 }),
      );
      expect(result).toEqual({ ok: false, error: "Course not found." });
    });

    it("on rename, reports it and refreshes both handles' pages", async () => {
      const { course, tee } = await fixtures.course();
      const handle = `renamed-${crypto.randomUUID()}`;
      const result = await courses.updateCourse(admin.id, editOf(course, [tee], { handle }));
      expect(result).toEqual({ ok: true, handle, renamed: true });
      expect((await stored(handle))?.id).toBe(course.id);
      expect(await stored(course.handle)).toBeUndefined();
      expect(refreshed()).toEqual(coursePaths(course.handle, handle));
    });

    it("deletes a replaced image", async () => {
      const { course, tee } = await fixtures.course();
      const oldImg = `${BLOB}/old-${crypto.randomUUID()}.webp`;
      await db.update(schema.courses).set({ imgUrl: oldImg }).where(eq(schema.courses.id, course.id));
      const newImg = `${BLOB}/new-${crypto.randomUUID()}.webp`;

      const result = await courses.updateCourse(
        admin.id,
        editOf({ ...course, imgUrl: oldImg }, [tee], { imgUrl: newImg }),
      );

      expect(result.ok).toBe(true);
      expect((await stored(course.handle))?.imgUrl).toBe(newImg);
      expect(del).toHaveBeenCalledExactlyOnceWith(oldImg);
    });

    it("keeps an unchanged image", async () => {
      const { course, tee } = await fixtures.course();
      const img = `${BLOB}/same-${crypto.randomUUID()}.webp`;
      await db.update(schema.courses).set({ imgUrl: img }).where(eq(schema.courses.id, course.id));
      const result = await courses.updateCourse(admin.id, editOf({ ...course, imgUrl: img }, [tee]));
      expect(result.ok).toBe(true);
      expect(del).not.toHaveBeenCalled();
    });
  });

  describe("deleteCourse", () => {
    it("refuses a Player who isn't a Platform Admin", async () => {
      const { course } = await fixtures.course();
      const result = await courses.deleteCourse(player.id, course.id);
      expect(result).toEqual({ ok: false, error: expect.stringMatching(/Platform Admin/) });
      expect(await stored(course.handle)).toBeDefined();
    });

    it("refuses a course with Tournaments", async () => {
      const t = await fixtures.tournament();
      const result = await courses.deleteCourse(admin.id, t.course.id);
      expect(result).toEqual({
        ok: false,
        error: "Cannot delete: course is assigned to 1 tournament(s).",
      });
      expect(await stored(t.course.handle)).toBeDefined();
    });

    it("refuses a course with Rounds", async () => {
      const { course, tee } = await fixtures.course();
      await casualRound(course.id, tee.id);
      await casualRound(course.id, tee.id);
      const result = await courses.deleteCourse(admin.id, course.id);
      expect(result).toEqual({
        ok: false,
        error: "Cannot delete: course is assigned to 2 round(s).",
      });
      expect(await stored(course.handle)).toBeDefined();
    });

    it("deletes the course and both images, and refreshes its pages", async () => {
      const { course } = await fixtures.course();
      const img = `${BLOB}/img-${crypto.randomUUID()}.webp`;
      const scorecard = `${BLOB}/card-${crypto.randomUUID()}.webp`;
      await db
        .update(schema.courses)
        .set({ imgUrl: img, scorecardImgUrl: scorecard })
        .where(eq(schema.courses.id, course.id));

      const result = await courses.deleteCourse(admin.id, course.id);

      expect(result).toEqual({ ok: true });
      expect(await stored(course.handle)).toBeUndefined();
      expect(del.mock.calls.map(([url]) => url).sort()).toEqual([scorecard, img].sort());
      expect(refreshed()).toEqual(coursePaths(course.handle));
      expect(updateTag).not.toHaveBeenCalled();
    });
  });
});
