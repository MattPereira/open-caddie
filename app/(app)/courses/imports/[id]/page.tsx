import { redirect } from "next/navigation";

import { PageContent } from "@/components/page-content";
import { inspectNewCourseScorecardImport } from "../../actions";
import { CourseImportReview } from "../../_components/course-import-review";

export default async function CourseImportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await inspectNewCourseScorecardImport(id);
  if (result.outcome === "published") redirect(`/courses/${result.handle}`);
  if (result.outcome !== "paused") redirect("/courses");

  return (
    <PageContent>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal">
          Complete course import
        </h1>
        <p className="text-sm text-muted-foreground">{result.import.target.name}</p>
      </div>
      <CourseImportReview initialImport={result.import} />
    </PageContent>
  );
}
