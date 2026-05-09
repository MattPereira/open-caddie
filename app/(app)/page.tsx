import Link from "next/link";
import { Edit03Icon, UserCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { getAllCourses } from "@/db/queries/courses";
import { getActiveRoundForUser } from "@/db/queries/rounds";
import { getUpcomingTournamentsForUser } from "@/db/queries/tournaments";
import { LoginPageForm } from "./_components/login-page-form";
import {
  InputScoresFlow,
  type ActiveRound,
} from "./_components/input-scores-flow";
import { toIsoDate } from "@/lib/utils";

type HomePageProps = {
  searchParams: Promise<{ action?: string }>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const session = await auth();

  if (!session?.user?.id) return <LoginPageForm />;

  const userId = session.user.id;
  const { action } = await searchParams;

  const [courses, tournaments, activeRow] = await Promise.all([
    getAllCourses(),
    getUpcomingTournamentsForUser(userId),
    getActiveRoundForUser(userId),
  ]);

  const activeRound: ActiveRound | null = activeRow
    ? {
        roundId: activeRow.roundId,
        courseName: activeRow.courseName,
        date: activeRow.date,
        tournamentLabel:
          activeRow.tournamentId != null
            ? `Tournament${activeRow.tournamentSeason ? ` · Season ${activeRow.tournamentSeason}` : ""}`
            : null,
      }
    : null;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const hasActiveRound = activeRound != null || action === "new";

  return (
    <main className="flex min-h-[calc(100vh-3rem)] flex-col items-center justify-center px-4 py-10">
      {hasActiveRound ? (
        <InputScoresFlow
          defaultDateIso={toIsoDate(today)}
          courses={courses.map((c) => ({
            handle: c.handle,
            name: c.name,
            rating: c.rating,
            slope: c.slope,
            imgUrl: c.imgUrl,
          }))}
          tournaments={tournaments.map((t) => ({
            id: t.id,
            date: t.date,
            startsAt: t.startsAt,
            season: t.season,
            clubName: t.clubName,
            courseImgUrl: t.courseImgUrl,
            courseHandle: t.courseHandle,
            courseName: t.courseName,
          }))}
          activeRound={activeRound}
        />
      ) : (
        <section className="flex w-full max-w-3xl flex-col items-center gap-8">
          <h1 className="text-center text-2xl font-medium tracking-normal text-foreground sm:text-3xl">
            {session.user.firstName
              ? `Good morning, ${session.user.firstName}`
              : "Good morning"}
          </h1>

          <div className="grid grid-cols-2 md:grid-cols-2 items-center gap-3">
            <Button asChild variant="outline" size="xl" className="w-full">
              <Link href="/?action=new">
                <HugeiconsIcon icon={Edit03Icon} data-icon="inline-start" />
                Input scores
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xl"
              className="w-full"
            >
              <HugeiconsIcon icon={UserCircleIcon} data-icon="inline-start" />
              View profile
            </Button>
          </div>
        </section>
      )}
    </main>
  );
}
