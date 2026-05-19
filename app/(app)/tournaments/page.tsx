import type { Metadata } from "next";

import { appPageIcons } from "@/components/app-nav-items";
import { PageHeading } from "@/components/page-heading";
import { getAllClubs } from "@/db/queries/clubs";
import { getCoursesWithTees } from "@/db/queries/courses";
import { getAllTournaments } from "@/db/queries/tournaments";
import { getCurrentUser } from "@/db/queries/users";
import { AddTournamentButton } from "./_components/add-tournament-button";
import { TournamentsBrowser } from "./_components/tournaments-browser";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tournaments",
};

export default async function TournamentsPage() {
  const [tournaments, currentUser] = await Promise.all([
    getAllTournaments(),
    getCurrentUser(),
  ]);

  const [clubs, courses] = currentUser?.isAdmin
    ? await Promise.all([getAllClubs(), getCoursesWithTees()])
    : [[], []];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex items-start justify-between gap-2">
        <PageHeading
          icon={appPageIcons.tournaments}
          description="Browse live, upcoming, and past tournaments"
        >
          Tournaments
        </PageHeading>
        {currentUser?.isAdmin ? (
          <AddTournamentButton clubs={clubs} courses={courses} />
        ) : null}
      </div>
      <TournamentsBrowser
        tournaments={tournaments.map((tournament) => ({
          ...tournament,
          date: tournament.date.toISOString().slice(0, 10),
        }))}
      />
    </main>
  );
}
