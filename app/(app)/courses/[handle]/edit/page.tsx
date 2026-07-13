import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PageContent } from "@/components/layout/page-content";
import { getCourseForEdit } from "@/lib/courses/queries";
import { getCurrentUser } from "@/lib/users/queries";
import { CourseForm } from "../../_components/course-form";

type EditCoursePageProps = {
  params: Promise<{ handle: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: EditCoursePageProps): Promise<Metadata> {
  const { handle } = await params;
  const course = await getCourseForEdit(handle);
  return {
    title: course ? `Edit ${course.name}` : "Edit course",
  };
}

export default async function EditCoursePage({
  params,
}: EditCoursePageProps) {
  const { handle } = await params;
  const [user, course] = await Promise.all([
    getCurrentUser(),
    getCourseForEdit(handle),
  ]);

  if (!user?.isAdmin) {
    redirect(`/courses/${handle}`);
  }

  if (!course) {
    notFound();
  }

  return (
    <PageContent>
      <h1 className="text-2xl font-semibold tracking-normal">Edit course</h1>
      <CourseForm course={course} />
    </PageContent>
  );
}
