import type { Metadata } from "next";

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
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-normal">
          Tournaments
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Browse live, upcoming, and past club tournaments.
        </p>
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
