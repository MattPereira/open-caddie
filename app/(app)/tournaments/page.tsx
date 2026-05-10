import type { Metadata } from "next";

import { appPageIcons } from "@/components/app-nav-items";
import { PageHeading } from "@/components/page-heading";
import { getAllTournaments } from "@/db/queries/tournaments";
import { TournamentsBrowser } from "./_components/tournaments-browser";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tournaments",
};

export default async function TournamentsPage() {
  const tournaments = await getAllTournaments();

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <PageHeading
        icon={appPageIcons.tournaments}
        description="Browse live, upcoming, and past tournaments"
      >
        Tournaments
      </PageHeading>
      <TournamentsBrowser
        tournaments={tournaments.map((tournament) => ({
          ...tournament,
          date: tournament.date.toISOString().slice(0, 10),
        }))}
      />
    </main>
  );
}
