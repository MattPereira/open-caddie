import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getAllCourses } from "@/db/queries/courses";
import { getUpcomingTournamentsForUser } from "@/db/queries/tournaments";
import { toIsoDate } from "@/lib/utils";
import { RoundSetupForm } from "./_components/round-setup-form";

export default async function NewRoundPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const [courses, tournaments] = await Promise.all([
    getAllCourses(),
    getUpcomingTournamentsForUser(session.user.id),
  ]);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return (
    <main className="flex min-h-[calc(100svh-3.5rem)] flex-col items-center justify-center p-5">
      <section className="flex w-full max-w-md flex-1 flex-col justify-center gap-6 sm:flex-none">
        <RoundSetupForm
          defaultDateIso={toIsoDate(today)}
          courses={courses.map((course) => ({
            handle: course.handle,
            name: course.name,
            rating: course.rating,
            slope: course.slope,
            imgUrl: course.imgUrl,
          }))}
          tournaments={tournaments.map((tournament) => ({
            id: tournament.id,
            date: tournament.date,
            startsAt: tournament.startsAt,
            season: tournament.season,
            clubName: tournament.clubName,
            courseImgUrl: tournament.courseImgUrl,
            courseHandle: tournament.courseHandle,
            courseName: tournament.courseName,
          }))}
        />
      </section>
    </main>
  );
}
