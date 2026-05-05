import { cache } from "react";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { courseHoles, courses } from "@/db/schema";

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
