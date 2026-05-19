import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/db/queries/users";
import { CourseCreateForm } from "../_components/course-create-form";

export const metadata: Metadata = {
  title: "Add course",
};

export const dynamic = "force-dynamic";

export default async function NewCoursePage() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) {
    redirect("/courses");
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal">Add course</h1>
      </div>
      <CourseCreateForm />
    </main>
  );
}
