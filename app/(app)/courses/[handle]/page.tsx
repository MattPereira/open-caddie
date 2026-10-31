import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CourseHero } from "@/components/domain/course-hero";
import { CourseHolesTable } from "./_components/course-holes-table";
import { CourseRecords } from "@/components/features/course-records/course-records";
import { getCourseByHandle } from "@/lib/courses/queries";
import { getCurrentUser } from "@/lib/users/queries";
import { PageContent } from "@/components/layout/page-content";
import { EditCourseButton } from "./_components/edit-course-button";

type CoursePageProps = {
  params: Promise<{
    handle: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: CoursePageProps): Promise<Metadata> {
  const { handle } = await params;
  const course = await getCourseByHandle(handle);

  return {
    title: course?.name ?? "Course",
  };
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { handle } = await params;
  const course = await getCourseByHandle(handle);

  if (!course) {
    notFound();
  }

  const currentUser = await getCurrentUser();

  return (
    <PageContent>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end gap-3">
          <h1 className="text-xl font-semibold tracking-normal">
            {course.name}
          </h1>
          {currentUser?.isAdmin ? <EditCourseButton course={course} /> : null}
        </div>

        <CourseHero courseName={course.name} courseImgUrl={course.imgUrl} />
      </div>

      <div className="flex flex-col gap-3">
        <CourseHolesTable holes={course.holes} tees={course.tees} />
      </div>

      <CourseRecords courseId={course.id} />
    </PageContent>
  );
}
