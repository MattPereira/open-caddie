import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GreeniesTabContent } from "@/components/greenies-tab-content";
import { RoundsTabContent } from "@/components/rounds-tab-content";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAllClubs } from "@/db/queries/clubs";
import { getCoursesWithTees } from "@/db/queries/courses";
import {
  getAddablePlayersForTournament,
  getTournamentById,
} from "@/db/queries/tournaments";
import { getCurrentUser } from "@/db/queries/users";
import { formatDate } from "@/lib/utils";
import { PageContent } from "@/components/page-content";
import { AddPlayersSheet } from "./_components/add-players-sheet";
import { EditTournamentButton } from "./_components/edit-tournament-button";
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

  const [addablePlayers, clubs, courses] = currentUser?.isAdmin
    ? await Promise.all([
        getAddablePlayersForTournament(tournament.id),
        getAllClubs(),
        getCoursesWithTees(),
      ])
    : [[], [], []];

  return (
    <PageContent>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-normal">Tournament</h1>
          {currentUser?.isAdmin ? (
            <EditTournamentButton
              tournament={{
                id: tournament.id,
                clubHandle: tournament.clubHandle,
                clubName: tournament.clubName,
                date: tournament.date,
                startsAt: tournament.startsAt,
                season: tournament.season,
                courseHandle: tournament.courseHandle,
                courseName: tournament.courseName,
                courseImgUrl: tournament.courseImgUrl,
                teeId: tournament.teeId,
              }}
              clubs={clubs}
              courses={courses}
            />
          ) : null}
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
          emptyMessage="No rounds have been recorded for this tournament."
          rounds={tournament.rounds}
        />
        <GreeniesTabContent
          emptyMessage="No greenies have been recorded for this tournament."
          greenies={tournament.greenies}
        />
      </Tabs>
    </PageContent>
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
