import { revalidatePath, updateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFixtures } from "@/test/fixtures";
import * as courses from "../server";

const { del } = vi.hoisted(() => ({ del: vi.fn() }));
vi.mock("@vercel/blob", () => ({ del }));

const BLOB = "https://abc.public.blob.vercel-storage.com";

describe("Course writes", () => {
  const fixtures = createFixtures();
  let admin: Awaited<ReturnType<typeof fixtures.player>>;
  let player: Awaited<ReturnType<typeof fixtures.player>>;

  async function stored(handle: string) {
    return courses.getCourseForEdit(handle);
  }

  async function storedTees(handle: string) {
    return (await stored(handle))?.tees ?? [];
  }

  async function casualRound(courseHandle: string, teeId: number) {
    const roundPlayer = await fixtures.player();
    await fixtures.casualRound(roundPlayer.id, { courseHandle, teeId });
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
    const calls = vi.mocked(revalidatePath).mock.calls as unknown as string[][];
    return [...new Set(calls.map((call) => call.join(" ")))].sort();
  }

  function coursePaths(...handles: string[]) {
    return [
      "/clubs/[handle] page",
      "/courses",
      ...handles.flatMap((handle) => [
        `/courses/${handle}`,
        `/courses/${handle}/edit`,
      ]),
    ].sort();
  }

  beforeEach(async () => {
    admin = await fixtures.player({ isAdmin: true });
    player = await fixtures.player();
    del.mockReset();
  });

  describe("tee helpers", () => {
    it("finds a course id by handle, or null", async () => {
      const { course } = await fixtures.course();
      expect(await courses.getCourseIdByHandle(course.handle)).toBe(course.id);
      expect(
        await courses.getCourseIdByHandle(`missing-${crypto.randomUUID()}`),
      ).toBeNull();
    });

    it("knows whether a tee belongs to a course", async () => {
      const a = await fixtures.course();
      const b = await fixtures.course();
      expect(await courses.isTeeForCourse(a.tee.id, a.course.id)).toBe(true);
      expect(await courses.isTeeForCourse(b.tee.id, a.course.id)).toBe(false);
    });
  });

  describe("createCourse", () => {
    function createInput(
      overrides: Partial<courses.CourseCreateInput> = {},
    ): courses.CourseCreateInput {
      const suffix = crypto.randomUUID();
      return {
        handle: `course-${suffix}`,
        name: `Course ${suffix}`,
        imgUrl: "",
        tees: [
          {
            name: "Blue",
            color: " blue ",
            rating: "71.2",
            slope: 128,
            yardages: Array.from({ length: 18 }, (_, i) =>
              i === 0 ? 410 : "",
            ),
            sortOrder: 0,
          },
          {
            name: "Red",
            color: "",
            rating: "68.5",
            slope: 110,
            yardages: Array.from({ length: 18 }, () => 300),
            sortOrder: 1,
          },
        ],
        holes: Array.from({ length: 18 }, (_, index) => ({
          hole: index + 1,
          par: index === 0 ? 5 : 4,
          handicap: index + 1,
        })),
        ...overrides,
      };
    }

    it("refuses a Player who isn't a Platform Admin", async () => {
      const input = createInput();
      const result = await courses.createCourse(player.id, input);
      expect(result).toEqual({
        ok: false,
        error: expect.stringMatching(/Platform Admin/),
      });
      expect(await stored(input.handle)).toBeUndefined();
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("saves the course, its tees in order, yardages and holes", async () => {
      const input = createInput({ imgUrl: `${BLOB}/course.webp` });

      const result = await courses.createCourse(admin.id, input);

      if (!result.ok) throw new Error(result.error);
      expect(result).toEqual({
        ok: true,
        id: expect.any(Number),
        handle: input.handle,
      });
      const saved = await stored(input.handle);
      expect(saved).toMatchObject({
        id: result.id,
        name: input.name,
        imgUrl: `${BLOB}/course.webp`,
        scorecardImgUrl: null,
        holes: input.holes,
      });
      expect(
        saved?.tees.map((t) => [
          t.name,
          t.color,
          t.rating,
          t.slope,
          t.sortOrder,
        ]),
      ).toEqual([
        ["Blue", "blue", "71.2", 128, 0],
        ["Red", null, "68.5", 110, 1],
      ]);
      expect(saved?.tees[0].yardages).toEqual([410, ...Array(17).fill(null)]);
      expect(saved?.tees[1].yardages).toEqual(Array(18).fill(300));
      expect(refreshed()).toEqual(coursePaths(input.handle));
    });

    it("stores a blank image as none", async () => {
      const input = createInput();
      await courses.createCourse(admin.id, input);
      expect((await stored(input.handle))?.imgUrl).toBeNull();
    });

    it("refuses a handle another course already has, saving nothing", async () => {
      const { course } = await fixtures.course();
      const result = await courses.createCourse(
        admin.id,
        createInput({ handle: course.handle }),
      );
      expect(result).toEqual({
        ok: false,
        error: "A course or tee with that name already exists.",
      });
      expect((await stored(course.handle))?.name).toBe(course.name);
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("refuses two tees with one name, saving nothing", async () => {
      const input = createInput();
      input.tees[1] = { ...input.tees[1], name: input.tees[0].name };
      const result = await courses.createCourse(admin.id, input);
      expect(result).toEqual({
        ok: false,
        error: "A course or tee with that name already exists.",
      });
      expect(await stored(input.handle)).toBeUndefined();
    });
  });

  describe("updateCourse", () => {
    it("refuses a Player who isn't a Platform Admin", async () => {
      const { course, tee } = await fixtures.course();
      const result = await courses.updateCourse(
        player.id,
        editOf(course, [tee], { name: "Renamed" }),
      );
      expect(result).toEqual({
        ok: false,
        error: expect.stringMatching(/Platform Admin/),
      });
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

      expect(result).toEqual({
        ok: true,
        handle: course.handle,
        renamed: false,
      });
      const saved = await stored(course.handle);
      expect(saved?.name).toBe("New Name");
      expect(
        saved?.tees.map((t) => [
          t.id === tee.id,
          t.name,
          t.color,
          t.rating,
          t.slope,
          t.sortOrder,
        ]),
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
      await fixtures.tee(course.handle);
      const result = await courses.updateCourse(
        admin.id,
        editOf(course, [tee]),
      );
      expect(result.ok).toBe(true);
      expect((await storedTees(course.handle)).map((t) => t.id)).toEqual([
        tee.id,
      ]);
    });

    it("refuses removing tees used by Tournaments or Rounds, with counts per tee", async () => {
      const t = await fixtures.tournament();
      await fixtures.tournamentPlayer(t);
      const keep = await fixtures.tee(t.course.handle, "Keep");
      const casualTee = await fixtures.tee(t.course.handle, "Casual");
      await casualRound(t.course.handle, casualTee.id);
      await casualRound(t.course.handle, casualTee.id);

      const result = await courses.updateCourse(
        admin.id,
        editOf(t.course, [keep]),
      );

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
      const result = await courses.updateCourse(
        admin.id,
        editOf(course, [tee], { handle }),
      );
      expect(result).toEqual({ ok: true, handle, renamed: true });
      expect((await stored(handle))?.id).toBe(course.id);
      expect(await stored(course.handle)).toBeUndefined();
      expect(refreshed()).toEqual(coursePaths(course.handle, handle));
    });

    it("deletes a replaced image", async () => {
      const oldImg = `${BLOB}/old-${crypto.randomUUID()}.webp`;
      const { course, tee } = await fixtures.course({ imgUrl: oldImg });
      const newImg = `${BLOB}/new-${crypto.randomUUID()}.webp`;

      const result = await courses.updateCourse(
        admin.id,
        editOf(course, [tee], { imgUrl: newImg }),
      );

      expect(result.ok).toBe(true);
      expect((await stored(course.handle))?.imgUrl).toBe(newImg);
      expect(del).toHaveBeenCalledExactlyOnceWith(oldImg);
    });

    it("keeps an unchanged image", async () => {
      const img = `${BLOB}/same-${crypto.randomUUID()}.webp`;
      const { course, tee } = await fixtures.course({ imgUrl: img });
      const result = await courses.updateCourse(
        admin.id,
        editOf(course, [tee]),
      );
      expect(result.ok).toBe(true);
      expect(del).not.toHaveBeenCalled();
    });
  });

  describe("deleteCourse", () => {
    it("refuses a Player who isn't a Platform Admin", async () => {
      const { course } = await fixtures.course();
      const result = await courses.deleteCourse(player.id, course.id);
      expect(result).toEqual({
        ok: false,
        error: expect.stringMatching(/Platform Admin/),
      });
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
      await casualRound(course.handle, tee.id);
      await casualRound(course.handle, tee.id);
      const result = await courses.deleteCourse(admin.id, course.id);
      expect(result).toEqual({
        ok: false,
        error: "Cannot delete: course is assigned to 2 round(s).",
      });
      expect(await stored(course.handle)).toBeDefined();
    });

    it("deletes the course and its image, and refreshes its pages", async () => {
      const img = `${BLOB}/img-${crypto.randomUUID()}.webp`;
      const { course } = await fixtures.course({ imgUrl: img });

      const result = await courses.deleteCourse(admin.id, course.id);

      expect(result).toEqual({ ok: true });
      expect(await stored(course.handle)).toBeUndefined();
      expect(del.mock.calls.map(([url]) => url)).toEqual([img]);
      expect(refreshed()).toEqual(coursePaths(course.handle));
      expect(updateTag).not.toHaveBeenCalled();
    });
  });
});
