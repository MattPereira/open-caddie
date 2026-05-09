import type { Metadata } from "next";

import { appPageIcons } from "@/components/app-nav-items";
import { PageHeading } from "@/components/page-heading";
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
        <PageHeading icon={appPageIcons.courses}>Courses</PageHeading>
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
