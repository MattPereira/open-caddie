import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PageContent } from "@/components/layout/page-content";
import {
  getPairingsForTournament,
  getTournamentById,
  getUnassignedRoundsForTournament,
} from "@/lib/tournaments/queries";
import { getCurrentUser } from "@/lib/users/queries";
import { formatDate } from "@/lib/dates";
import { PairingsManager } from "./_components/pairings-manager";

type PairingsPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pairings",
};

export default async function TournamentPairingsPage({
  params,
}: PairingsPageProps) {
  const { id } = await params;
  const tournamentId = Number(id);
  if (!Number.isInteger(tournamentId) || tournamentId <= 0) notFound();

  const [tournament, currentUser] = await Promise.all([
    getTournamentById(tournamentId),
    getCurrentUser(),
  ]);

  if (!tournament) notFound();
  if (!currentUser?.isAdmin) redirect(`/tournaments/${tournamentId}`);

  const [pairings, unassigned] = await Promise.all([
    getPairingsForTournament(tournamentId),
    getUnassignedRoundsForTournament(tournamentId),
  ]);

  return (
    <PageContent className="max-w-3xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal">Pairings</h1>
        <p className="text-base text-muted-foreground">
          {[tournament.courseName, formatDate(tournament.date, "shorter")]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <PairingsManager
        tournamentId={tournamentId}
        pairings={pairings}
        unassigned={unassigned}
        backHref={`/tournaments/${tournamentId}`}
      />
    </PageContent>
  );
}
