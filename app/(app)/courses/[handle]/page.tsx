import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { GolfHoleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { getCourseByHandle } from "@/db/queries/courses";

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

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-normal">
          {course.name}
        </h1>
      </div>

      <div className="relative aspect-video w-full max-w-5xl overflow-hidden rounded-lg bg-muted">
        {course.imgUrl ? (
          <Image
            src={course.imgUrl}
            alt={course.name}
            fill
            sizes="(min-width: 1024px) 1024px, 100vw"
            className="object-cover"
            priority
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <HugeiconsIcon icon={GolfHoleIcon} size={48} aria-hidden />
          </div>
        )}
      </div>
    </main>
  );
}
