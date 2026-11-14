import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PageContent } from "@/components/layout/page-content";
import { getCourseForEdit } from "@/modules/courses";
import { getCurrentPlayer } from "@/modules/players";
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
  const [player, course] = await Promise.all([
    getCurrentPlayer(),
    getCourseForEdit(handle),
  ]);

  if (!player?.isAdmin) {
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
