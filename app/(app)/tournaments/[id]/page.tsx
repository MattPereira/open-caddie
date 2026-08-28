import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CourseHero } from "@/components/domain/course-hero";
import { GreeniesTabContent } from "./_components/greenies-tab-content";
import { PlayRoundButton } from "@/components/domain/play-round-button";
import { RoundsTabContent } from "@/components/features/scores/rounds-tab-content";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UrlTabs } from "@/components/shared/url-tabs";
import { getTournamentById } from "@/lib/tournaments/queries";
import { getCurrentUser } from "@/lib/users/queries";
import { createPageMetadata } from "@/app/metadata";
import { formatDate } from "@/lib/dates";
import { PageContent } from "@/components/layout/page-content";
import { UploadScorecardButton } from "@/components/features/scorecard-import/upload-scorecard-button";
import { EditTournamentLink } from "./_components/edit-tournament-link";
import { WinnersTabContent } from "./_components/winners-tab-content";

type TournamentPageProps = {
  params: Promise<{
    id: string;
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
}: TournamentPageProps) {
  const [{ id }, currentUser] = await Promise.all([params, getCurrentUser()]);

  const tournamentId = Number(id);
  if (!Number.isInteger(tournamentId) || tournamentId <= 0) notFound();

  const tournament = await getTournamentById(tournamentId);

  if (!tournament) notFound();
  const currentUserUnfinishedRound = currentUser
    ? tournament.rounds.find(
        (round) => round.userId === currentUser.id && !round.isComplete,
      )
    : null;

  return (
    <PageContent className="max-w-5xl">
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center gap-2">
          <div className="flex flex-col">
            <h1 className="text-2xl font-semibold tracking-normal">
              Tournament
            </h1>
            <p className="text-sm text-muted-foreground">
              {tournament.clubName} · Season {tournament.season}
            </p>
          </div>

          {currentUser?.isAdmin ? (
            <EditTournamentLink href={`/tournaments/${tournament.id}/edit`} />
          ) : null}
        </div>
        <CourseHero
          courseName={tournament.courseName}
          courseImgUrl={tournament.courseImgUrl}
          date={tournament.date}
        />
        {currentUserUnfinishedRound ? (
          <PlayRoundButton
            href={`/rounds/${currentUserUnfinishedRound.id}/play`}
          />
        ) : null}
      </div>

      <UrlTabs
        defaultValue="rounds"
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
              <UploadScorecardButton
                href={`/tournaments/${tournament.id}/upload-scorecard`}
                className="w-full sm:w-auto"
              />
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

async function getTournamentFromParams(params: TournamentPageProps["params"]) {
  const { id } = await params;
  const tournamentId = Number(id);

  if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
    return null;
  }

  return getTournamentById(tournamentId);
}
