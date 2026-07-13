import type { Metadata } from "next";
import Link from "next/link";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { appPageIcons } from "@/components/layout/app-nav-items";
import { PageContent } from "@/components/layout/page-content";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { getAllCourses } from "@/lib/courses/queries";
import { getCurrentUser } from "@/lib/users/queries";
import { CoursesBrowser } from "./_components/courses-browser";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Courses",
};

export default async function CoursesPage() {
  const [courses, currentUser] = await Promise.all([
    getAllCourses(),
    getCurrentUser(),
  ]);

  return (
    <PageContent>
      <div className="flex items-start gap-2">
        <PageHeading
          icon={appPageIcons.courses}
          description="Select a course to see player records"
        >
          Courses
        </PageHeading>
        {currentUser?.isAdmin ? (
          <div className="ml-auto">
            <Button
              asChild
              variant="ghost"
              size="icon-xl"
              aria-label="Add course"
            >
              <Link href="/courses/new">
                <HugeiconsIcon icon={Add01Icon} aria-hidden />
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
      <CoursesBrowser courses={courses} />
    </PageContent>
  );
}
