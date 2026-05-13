import { cache } from "react";
import { and, asc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import {
  courseHoles,
  courses,
  greenies,
  roundSummaries,
  rounds,
  users,
} from "@/db/schema";

export const getAllCourses = cache(async () => {
  const rows = await db
    .select({
      id: courses.id,
      handle: courses.handle,
      name: courses.name,
      rating: courses.rating,
      slope: courses.slope,
      imgUrl: courses.imgUrl,
    })
    .from(courses)
    .orderBy(asc(courses.name));

  const holes = await db
    .select({
      courseId: courseHoles.courseId,
      hole: courseHoles.hole,
      par: courseHoles.par,
      handicap: courseHoles.handicap,
    })
    .from(courseHoles)
    .orderBy(asc(courseHoles.courseId), asc(courseHoles.hole));

  const holesByCourse = new Map<number, typeof holes>();
  for (const hole of holes) {
    const courseHoles = holesByCourse.get(hole.courseId) ?? [];
    courseHoles.push(hole);
    holesByCourse.set(hole.courseId, courseHoles);
  }

  return rows.map((course) => ({
    ...course,
    holes: holesByCourse.get(course.id) ?? [],
  }));
});

export const getCourseByHandle = cache(async (handle: string) => {
  const [course] = await db
    .select({
      id: courses.id,
      handle: courses.handle,
      name: courses.name,
      rating: courses.rating,
      slope: courses.slope,
      imgUrl: courses.imgUrl,
    })
    .from(courses)
    .where(eq(courses.handle, handle))
    .limit(1);

  if (!course) {
    return undefined;
  }

  const holes = await db
    .select({
      hole: courseHoles.hole,
      par: courseHoles.par,
      handicap: courseHoles.handicap,
    })
    .from(courseHoles)
    .where(eq(courseHoles.courseId, course.id))
    .orderBy(asc(courseHoles.hole));

  return { ...course, holes };
});

export const getLowestRoundsByCourseId = cache(
  async (courseId: number, limit = 3) => {
    return db
      .select({
        roundId: roundSummaries.roundId,
        date: roundSummaries.date,
        totalStrokes: roundSummaries.totalStrokes,
        firstName: users.firstName,
        lastName: users.lastName,
        username: users.username,
        email: users.email,
        image: users.image,
      })
      .from(roundSummaries)
      .innerJoin(users, eq(roundSummaries.userId, users.id))
      .where(
        and(
          eq(roundSummaries.courseId, courseId),
          eq(roundSummaries.isComplete, true),
        ),
      )
      .orderBy(asc(roundSummaries.totalStrokes))
      .limit(limit);
  },
);

export const getFewestPuttsRoundsByCourseId = cache(
  async (courseId: number, limit = 3) => {
    return db
      .select({
        roundId: roundSummaries.roundId,
        date: roundSummaries.date,
        totalPutts: roundSummaries.totalPutts,
        firstName: users.firstName,
        lastName: users.lastName,
        username: users.username,
        email: users.email,
        image: users.image,
      })
      .from(roundSummaries)
      .innerJoin(users, eq(roundSummaries.userId, users.id))
      .where(
        and(
          eq(roundSummaries.courseId, courseId),
          eq(roundSummaries.isComplete, true),
          gte(roundSummaries.recordedPuttsCount, 18),
        ),
      )
      .orderBy(asc(roundSummaries.totalPutts))
      .limit(limit);
  },
);

export const getClosestGreeniesByCourseId = cache(async (courseId: number) => {
  const rows = await db
    .select({
      hole: greenies.hole,
      feet: greenies.feet,
      inches: greenies.inches,
      roundDate: rounds.date,
      firstName: users.firstName,
      lastName: users.lastName,
      username: users.username,
      image: users.image,
    })
    .from(greenies)
    .innerJoin(rounds, eq(greenies.roundId, rounds.id))
    .innerJoin(users, eq(rounds.userId, users.id))
    .where(eq(rounds.courseId, courseId))
    .orderBy(asc(greenies.hole), asc(greenies.feet), asc(greenies.inches));

  const closestByHole = new Map<number, (typeof rows)[number]>();
  for (const row of rows) {
    if (!closestByHole.has(row.hole)) {
      closestByHole.set(row.hole, row);
    }
  }

  return Array.from(closestByHole.values());
});
