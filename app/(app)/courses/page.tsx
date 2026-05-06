import type { Metadata } from "next";

import { getAllCourses } from "@/db/queries/courses";
import { CoursesBrowser } from "./_components/courses-browser";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Courses",
};

export default async function CoursesPage() {
  const courses = await getAllCourses();

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-normal">Courses</h1>
        <div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Browse the courses used for club tournaments and rounds.
          </p>
        </div>
      </div>

      <CoursesBrowser courses={courses} />
    </main>
  );
}
