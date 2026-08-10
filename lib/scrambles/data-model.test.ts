import { afterEach, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  describe.skip("Scramble data model", () => {
    it("requires TEST_DATABASE_URL", () => {});
  });
} else {
  describe("Scramble data model", async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.DATABASE_DRIVER = "node-postgres";
    const [{ db }, schema] = await Promise.all([
      import("@/db"),
      import("@/db/schema"),
    ]);
    const { count, eq } = await import("drizzle-orm");
    const courseIds: number[] = [];
    const scrambleIds: number[] = [];

    async function fixture() {
      const suffix = crypto.randomUUID();
      const [course] = await db
        .insert(schema.courses)
        .values({ handle: `course-${suffix}`, name: `Course ${suffix}` })
        .returning();
      const [tee] = await db
        .insert(schema.courseTees)
        .values({ courseId: course.id, name: "Blue", rating: "72", slope: 120 })
        .returning();
      const [scramble] = await db
        .insert(schema.scrambles)
        .values({
          handle: `scramble-${suffix}`,
          name: "Driven to Serve",
          date: new Date("2026-09-19T00:00:00"),
          startTime: "08:00",
          timezone: "America/Los_Angeles",
          courseId: course.id,
          teeId: tee.id,
        })
        .returning();
      courseIds.push(course.id);
      scrambleIds.push(scramble.id);
      return { course, scramble, tee };
    }

    afterEach(async () => {
      for (const scrambleId of scrambleIds) {
        await db
          .delete(schema.scrambleTeams)
          .where(eq(schema.scrambleTeams.scrambleId, scrambleId));
        await db
          .delete(schema.scrambles)
          .where(eq(schema.scrambles.id, scrambleId));
      }
      for (const courseId of courseIds) {
        await db.delete(schema.courses).where(eq(schema.courses.id, courseId));
      }
      scrambleIds.length = 0;
      courseIds.length = 0;
    });

    it("records a Scramble independently from Rounds and Tournaments", async () => {
      const [{ value: summariesBefore }] = await db
        .select({ value: count() })
        .from(schema.roundSummaries);
      const { course, scramble, tee } = await fixture();

      expect(scramble).toMatchObject({
        courseId: course.id,
        teeId: tee.id,
        handle: expect.stringMatching(/^scramble-/),
      });
      const [{ value: summariesAfter }] = await db
        .select({ value: count() })
        .from(schema.roundSummaries);
      expect(summariesAfter).toBe(summariesBefore);
    });

    it("rejects a Tee belonging to another Course", async () => {
      const suffix = crypto.randomUUID();
      const [west, east] = await db
        .insert(schema.courses)
        .values([
          { handle: `west-${suffix}`, name: "West" },
          { handle: `east-${suffix}`, name: "East" },
        ])
        .returning();
      const [eastTee] = await db
        .insert(schema.courseTees)
        .values({ courseId: east.id, name: "Blue", rating: "72", slope: 120 })
        .returning();
      courseIds.push(west.id, east.id);

      await expect(
        db.insert(schema.scrambles).values({
          handle: `scramble-${suffix}`,
          name: "Driven to Serve",
          date: new Date("2026-09-19T00:00:00"),
          startTime: "08:00",
          timezone: "America/Los_Angeles",
          courseId: west.id,
          teeId: eastTee.id,
        }),
      ).rejects.toMatchObject({ cause: { code: "23503" } });
    });

    it("rejects a non-lowercase public handle", async () => {
      const { course, tee } = await fixture();

      await expect(
        db.insert(schema.scrambles).values({
          handle: `Invalid-${crypto.randomUUID()}`,
          name: "Invalid",
          date: new Date("2026-09-19T00:00:00"),
          startTime: "08:00",
          timezone: "America/Los_Angeles",
          courseId: course.id,
          teeId: tee.id,
        }),
      ).rejects.toMatchObject({ cause: { code: "23514" } });
    });

    it("restricts Scramble deletion and cascades Team-owned records", async () => {
      const { scramble } = await fixture();
      const [team] = await db
        .insert(schema.scrambleTeams)
        .values({ scrambleId: scramble.id, name: "Team One", startingHole: 7 })
        .returning();
      await db.insert(schema.scrambleTeamMembers).values({ teamId: team.id, name: "Alex" });
      await db.insert(schema.scrambleTeamScores).values({ teamId: team.id, hole: 7, strokes: 4 });
      await expect(
        db.delete(schema.scrambles).where(eq(schema.scrambles.id, scramble.id)),
      ).rejects.toMatchObject({ cause: { code: "23503" } });

      await db.delete(schema.scrambleTeams).where(eq(schema.scrambleTeams.id, team.id));
      expect(
        await db.select().from(schema.scrambleTeamMembers).where(eq(schema.scrambleTeamMembers.teamId, team.id)),
      ).toEqual([]);
      expect(
        await db.select().from(schema.scrambleTeamScores).where(eq(schema.scrambleTeamScores.teamId, team.id)),
      ).toEqual([]);
    });

    it("enforces Team and Team Score constraints", async () => {
      const { scramble } = await fixture();
      const [team] = await db.insert(schema.scrambleTeams).values({ scrambleId: scramble.id, name: "Firefighters", startingHole: 1 }).returning();

      await expect(
        db.insert(schema.scrambleTeams).values({ scrambleId: scramble.id, name: "FIREFIGHTERS", startingHole: 2 }),
      ).rejects.toMatchObject({ cause: { code: "23505" } });
      await expect(
        db.insert(schema.scrambleTeamScores).values({ teamId: team.id, hole: 19, strokes: 4 }),
      ).rejects.toMatchObject({ cause: { code: "23514" } });
      await expect(
        db.insert(schema.scrambleTeamScores).values({ teamId: team.id, hole: 1, strokes: 0 }),
      ).rejects.toMatchObject({ cause: { code: "23514" } });
    });
  });
}
