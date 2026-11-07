import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { courseTees, courses } from "@/db/schema";

type Reader = Pick<typeof db, "select">;

export async function getCourseIdByHandle(handle: string, reader: Reader = db) {
  const [course] = await reader
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.handle, handle))
    .limit(1);
  return course?.id ?? null;
}

export async function isTeeForCourse(
  teeId: number,
  courseId: number,
  reader: Reader = db,
) {
  const [row] = await reader
    .select({ id: courseTees.id })
    .from(courseTees)
    .where(and(eq(courseTees.id, teeId), eq(courseTees.courseId, courseId)))
    .limit(1);
  return row != null;
}
