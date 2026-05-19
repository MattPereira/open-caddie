import { cache } from "react";
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  courseHoles,
  courseTees,
  courses,
  greenies,
  roundSummaries,
  rounds,
  teeYardages,
  users,
} from "@/db/schema";

export async function getPrimaryTeeIdByCourseId(
  courseId: number,
): Promise<number | null> {
  const [row] = await db
    .select({ id: courseTees.id })
    .from(courseTees)
    .where(eq(courseTees.courseId, courseId))
    .orderBy(asc(courseTees.sortOrder))
    .limit(1);
  return row?.id ?? null;
}

type PrimaryTee = { rating: string; slope: number };

async function getPrimaryTeeByCourseId(): Promise<Map<number, PrimaryTee>> {
  const tees = await db
    .select({
      courseId: courseTees.courseId,
      rating: courseTees.rating,
      slope: courseTees.slope,
      sortOrder: courseTees.sortOrder,
    })
    .from(courseTees)
    .orderBy(asc(courseTees.courseId), asc(courseTees.sortOrder));

  const byCourse = new Map<number, PrimaryTee>();
  for (const tee of tees) {
    if (!byCourse.has(tee.courseId)) {
      byCourse.set(tee.courseId, { rating: tee.rating, slope: tee.slope });
    }
  }
  return byCourse;
}

export const getAllCourses = cache(async () => {
  const rows = await db
    .select({
      id: courses.id,
      handle: courses.handle,
      name: courses.name,
      imgUrl: courses.imgUrl,
    })
    .from(courses)
    .orderBy(asc(courses.name));

  const [holes, primaryTeeByCourse] = await Promise.all([
    db
      .select({
        courseId: courseHoles.courseId,
        hole: courseHoles.hole,
        par: courseHoles.par,
        handicap: courseHoles.handicap,
      })
      .from(courseHoles)
      .orderBy(asc(courseHoles.courseId), asc(courseHoles.hole)),
    getPrimaryTeeByCourseId(),
  ]);

  const holesByCourse = new Map<number, typeof holes>();
  for (const hole of holes) {
    const courseHoles = holesByCourse.get(hole.courseId) ?? [];
    courseHoles.push(hole);
    holesByCourse.set(hole.courseId, courseHoles);
  }

  return rows.map((course) => {
    const tee = primaryTeeByCourse.get(course.id);
    return {
      ...course,
      rating: tee?.rating ?? "0",
      slope: tee?.slope ?? 0,
      holes: holesByCourse.get(course.id) ?? [],
    };
  });
});

export const getCourseByHandle = cache(async (handle: string) => {
  const [course] = await db
    .select({
      id: courses.id,
      handle: courses.handle,
      name: courses.name,
      imgUrl: courses.imgUrl,
    })
    .from(courses)
    .where(eq(courses.handle, handle))
    .limit(1);

  if (!course) {
    return undefined;
  }

  const [holes, [primaryTee]] = await Promise.all([
    db
      .select({
        hole: courseHoles.hole,
        par: courseHoles.par,
        handicap: courseHoles.handicap,
      })
      .from(courseHoles)
      .where(eq(courseHoles.courseId, course.id))
      .orderBy(asc(courseHoles.hole)),
    db
      .select({ rating: courseTees.rating, slope: courseTees.slope })
      .from(courseTees)
      .where(eq(courseTees.courseId, course.id))
      .orderBy(asc(courseTees.sortOrder))
      .limit(1),
  ]);

  return {
    ...course,
    rating: primaryTee?.rating ?? "0",
    slope: primaryTee?.slope ?? 0,
    holes,
  };
});

export type CourseForEditTee = {
  id: number;
  name: string;
  color: string | null;
  rating: string;
  slope: number;
  sortOrder: number;
  yardages: (number | null)[];
};

export type CourseForEdit = {
  id: number;
  handle: string;
  name: string;
  imgUrl: string | null;
  scorecardImgUrl: string | null;
  tees: CourseForEditTee[];
  holes: { hole: number; par: number; handicap: number }[];
};

export const getCourseForEdit = cache(
  async (handle: string): Promise<CourseForEdit | undefined> => {
    const [course] = await db
      .select({
        id: courses.id,
        handle: courses.handle,
        name: courses.name,
        imgUrl: courses.imgUrl,
        scorecardImgUrl: courses.scorecardImgUrl,
      })
      .from(courses)
      .where(eq(courses.handle, handle))
      .limit(1);

    if (!course) return undefined;

    const [tees, holes] = await Promise.all([
      db
        .select({
          id: courseTees.id,
          name: courseTees.name,
          color: courseTees.color,
          rating: courseTees.rating,
          slope: courseTees.slope,
          sortOrder: courseTees.sortOrder,
        })
        .from(courseTees)
        .where(eq(courseTees.courseId, course.id))
        .orderBy(asc(courseTees.sortOrder), asc(courseTees.id)),
      db
        .select({
          hole: courseHoles.hole,
          par: courseHoles.par,
          handicap: courseHoles.handicap,
        })
        .from(courseHoles)
        .where(eq(courseHoles.courseId, course.id))
        .orderBy(asc(courseHoles.hole)),
    ]);

    const teeIds = tees.map((t) => t.id);
    const yardageRows = teeIds.length
      ? await db
          .select({
            teeId: teeYardages.teeId,
            hole: teeYardages.hole,
            yards: teeYardages.yards,
          })
          .from(teeYardages)
          .where(inArray(teeYardages.teeId, teeIds))
      : [];

    const yardagesByTee = new Map<number, (number | null)[]>();
    for (const tee of tees) {
      yardagesByTee.set(tee.id, Array<number | null>(18).fill(null));
    }
    for (const row of yardageRows) {
      const arr = yardagesByTee.get(row.teeId);
      if (arr && row.hole >= 1 && row.hole <= 18) {
        arr[row.hole - 1] = row.yards;
      }
    }

    return {
      ...course,
      tees: tees.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        rating: t.rating,
        slope: t.slope,
        sortOrder: t.sortOrder,
        yardages: yardagesByTee.get(t.id) ?? Array<number | null>(18).fill(null),
      })),
      holes,
    };
  },
);

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
