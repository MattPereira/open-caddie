import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CourseHero } from "@/components/domain/course-hero";
import { GreeniesTabContent } from "./_components/greenies-tab-content";
import { PlayRoundButton } from "@/components/domain/play-round-button";
import { RoundsTabContent } from "@/components/features/scores/rounds-tab-content";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UrlTabs } from "@/components/shared/url-tabs";
import { getAllClubsWithSeasons } from "@/lib/clubs/queries";
import { getCoursesWithTees } from "@/lib/courses/queries";
import {
  getAddablePlayersForTournament,
  getTournamentById,
} from "@/lib/tournaments/queries";
import { getCurrentUser } from "@/lib/users/queries";
import { createPageMetadata } from "@/app/metadata";
import { formatDate } from "@/lib/dates";
import { PageContent } from "@/components/layout/page-content";
import { UploadScorecardButton } from "@/components/features/scorecard-import/upload-scorecard-button";
import { AddPlayersSheet } from "./_components/add-players-sheet";
import { PairingsButton } from "./_components/pairings-button";
import { EditTournamentButton } from "./_components/edit-tournament-button";
import { WinnersTabContent } from "./_components/winners-tab-content";

type TournamentPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    tab?: string;
  }>;
};

export const dynamic = "force-dynamic";

const tournamentTabValues = ["rounds", "greenies", "winners"] as const;

export async function generateMetadata({
  params,
}: TournamentPageProps): Promise<Metadata> {
  const tournament = await getTournamentFromParams(params);

  return createPageMetadata({
    title: tournament?.clubName ?? "Tournament",
    description: tournament
      ? `${tournament.clubName} tournament at ${tournament.courseName ?? "the course"} on ${formatDate(tournament.date, "short")}.`
      : "Tournament details on Open Caddie.",
  });
}

export default async function TournamentPage({
  params,
  searchParams,
}: TournamentPageProps) {
  const [tournament, currentUser, resolvedSearchParams] = await Promise.all([
    getTournamentFromParams(params),
    getCurrentUser(),
    searchParams,
  ]);

  if (!tournament) notFound();
  const defaultTab = getTournamentDefaultTab(resolvedSearchParams?.tab);
  const currentUserUnfinishedRound = currentUser
    ? tournament.rounds.find(
        (round) => round.userId === currentUser.id && !round.isComplete,
      )
    : null;

  const [addablePlayers, clubs, courses] = currentUser?.isAdmin
    ? await Promise.all([
        getAddablePlayersForTournament(tournament.id),
        getAllClubsWithSeasons(),
        getCoursesWithTees(),
      ])
    : [[], [], []];

  return (
    <PageContent className="max-w-5xl">
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center gap-2">
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-normal">
                Tournament
              </h1>
              {currentUser?.isAdmin ? (
                <EditTournamentButton
                  tournament={{
                    id: tournament.id,
                    clubHandle: tournament.clubHandle,
                    clubName: tournament.clubName,
                    date: tournament.date,
                    season: tournament.season,
                    seasonId: tournament.seasonId,
                    courseHandle: tournament.courseHandle,
                    courseName: tournament.courseName,
                    courseImgUrl: tournament.courseImgUrl,
                    teeId: tournament.teeId,
                  }}
                  clubs={clubs}
                  courses={courses}
                />
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {tournament.clubName} · Season {tournament.season}
            </p>
          </div>

        </div>
        <CourseHero
          courseName={tournament.courseName}
          courseImgUrl={tournament.courseImgUrl}
          date={tournament.date}
        />
        {currentUserUnfinishedRound ? (
          <PlayRoundButton href={`/rounds/${currentUserUnfinishedRound.id}/play`} />
        ) : null}
      </div>

      <UrlTabs
        defaultValue={defaultTab}
        values={tournamentTabValues}
        className="w-full"
      >
        <TabsList className="w-full p-1 sm:w-fit mb-3 h-10!">
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
          <TabsTrigger
            value="winners"
            className="flex-1 px-5 py-2 text-base sm:flex-none"
          >
            Winners
          </TabsTrigger>
        </TabsList>

        <RoundsTabContent
          currentUser={currentUser}
          emptyMessage="No rounds have been recorded for this tournament."
          rounds={tournament.rounds}
          actions={
            currentUser?.isAdmin ? (
              <>
                <AddPlayersSheet
                  tournamentId={tournament.id}
                  players={addablePlayers}
                />
                <PairingsButton href={`/tournaments/${tournament.id}/pairings`} />
                <UploadScorecardButton
                  href={`/tournaments/${tournament.id}/upload-scorecard`}
                />
              </>
            ) : null
          }
        />
        <GreeniesTabContent
          emptyMessage="No greenies have been recorded for this tournament."
          greenies={tournament.greenies}
        />
        <WinnersTabContent
          rounds={tournament.rounds}
          greenies={tournament.greenies}
        />
      </UrlTabs>
    </PageContent>
  );
}

function getTournamentDefaultTab(tab: string | undefined) {
  return tab === "greenies" || tab === "winners" ? tab : "rounds";
}

async function getTournamentFromParams(params: TournamentPageProps["params"]) {
  const { id } = await params;
  const tournamentId = Number(id);

  if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
    return null;
  }

  return getTournamentById(tournamentId);
}
