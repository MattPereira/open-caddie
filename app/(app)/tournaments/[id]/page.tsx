import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getAddablePlayersForTournament,
  getTournamentById,
} from "@/db/queries/tournaments";
import { getCurrentUser } from "@/db/queries/users";
import { formatDate } from "@/lib/utils";
import { AddPlayersSheet } from "./_components/add-players-sheet";
import { GreeniesTabContent } from "./_components/greenies-tab-content";
import { RoundsTabContent } from "./_components/rounds-tab-content";
import { WinnersTabContent } from "./_components/winners-tab-content";

type TournamentPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: TournamentPageProps): Promise<Metadata> {
  const tournament = await getTournamentFromParams(params);

  return {
    title: tournament?.courseName ?? "Tournament",
  };
}

export default async function TournamentPage({ params }: TournamentPageProps) {
  const [tournament, currentUser] = await Promise.all([
    getTournamentFromParams(params),
    getCurrentUser(),
  ]);

  if (!tournament) notFound();

  const addablePlayers = currentUser?.isAdmin
    ? await getAddablePlayersForTournament(tournament.id)
    : [];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-end gap-2">
          <h1 className="text-2xl font-semibold tracking-normal">Tournament</h1>
          {currentUser?.isAdmin ? (
            <div className="ml-auto">
              <AddPlayersSheet
                tournamentId={tournament.id}
                players={addablePlayers}
              />
            </div>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {[tournament.courseName, formatDate(tournament.date, "short")]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <Tabs defaultValue="winners" className="w-full">
        <TabsList className="w-full p-1 sm:w-fit mb-3 h-10!">
          <TabsTrigger
            value="winners"
            className="flex-1 px-5 py-2 text-base sm:flex-none"
          >
            Winners
          </TabsTrigger>
          <TabsTrigger
            value="rounds"
            className="flex-1 px-5 py-2 text-base sm:flex-none"
          >
            Rounds
          </TabsTrigger>
          <TabsTrigger
            value="greenies"
            className="flex-1 px-5 py-2 text-base sm:flex-none"
          >
            Greenies
          </TabsTrigger>
        </TabsList>

        <WinnersTabContent
          rounds={tournament.rounds}
          greenies={tournament.greenies}
        />
        <RoundsTabContent
          currentUser={currentUser}
          rounds={tournament.rounds}
        />
        <GreeniesTabContent greenies={tournament.greenies} />
      </Tabs>
    </main>
  );
}

async function getTournamentFromParams(params: TournamentPageProps["params"]) {
  const { id } = await params;
  const tournamentId = Number(id);

  if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
    return null;
  }

  return getTournamentById(tournamentId);
}
