import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CourseHero } from "@/components/course-hero";
import { CourseHolesTable } from "@/components/course-holes-table";
import { GreenieCard } from "@/components/greenie-card";
import { displayName, getInitials } from "@/components/player-card";
import { WinnerCard } from "@/components/winner-card";
import { formatDate } from "@/lib/utils";
import {
  getClosestGreeniesByCourseId,
  getCourseByHandle,
  getFewestPuttsRoundsByCourseId,
  getLowestRoundsByCourseId,
} from "@/db/queries/courses";
import { getCurrentUser } from "@/db/queries/users";
import { PageContent } from "@/components/page-content";
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

  const [lowestRounds, fewestPuttsRounds, closestGreenies, currentUser] =
    await Promise.all([
      getLowestRoundsByCourseId(course.id),
      getFewestPuttsRoundsByCourseId(course.id),
      getClosestGreeniesByCourseId(course.id),
      getCurrentUser(),
    ]);

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

      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-medium">Best Rounds</h3>
        {lowestRounds.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {lowestRounds.map((round) => (
              <WinnerCard
                key={round.roundId}
                playerName={displayName(round)}
                initials={getInitials(round)}
                image={round.image}
                secondary={formatDate(round.date, "short")}
                primaryLabel="Strokes"
                primaryValue={round.totalStrokes}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-lg bg-muted px-3 py-6 text-center text-sm text-muted-foreground">
            No complete rounds on this course yet.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-medium">Fewest Putts</h3>
        {fewestPuttsRounds.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {fewestPuttsRounds.map((round) => (
              <WinnerCard
                key={round.roundId}
                playerName={displayName(round)}
                initials={getInitials(round)}
                image={round.image}
                secondary={formatDate(round.date, "short")}
                primaryLabel="Putts"
                primaryValue={round.totalPutts}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-lg bg-muted px-3 py-6 text-center text-sm text-muted-foreground">
            No rounds with full putt data on this course yet.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-medium">Closest Greenies</h3>
        {closestGreenies.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {closestGreenies.map((greenie) => (
              <GreenieCard
                key={`greenie-${greenie.hole}`}
                greenie={greenie}
                details={formatDate(greenie.roundDate, "short")}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-lg bg-muted px-3 py-6 text-center text-sm text-muted-foreground">
            No greenies recorded on this course yet.
          </p>
        )}
      </div>
    </PageContent>
  );
}
