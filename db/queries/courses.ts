import { cache } from "react";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { courses } from "@/db/schema";

export const getAllCourses = cache(async () => {
  return db
    .select({ handle: courses.handle, name: courses.name })
    .from(courses)
    .orderBy(asc(courses.name));
});
