import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UrlTabs } from "@/components/shared/url-tabs";
import { PageContent } from "@/components/layout/page-content";
import { CourseHero } from "@/components/domain/course-hero";
import { TournamentForm } from "../../_components/tournament-form";
import { getAllClubsWithSeasons } from "@/lib/clubs/queries";
import { getCoursesWithTees } from "@/lib/courses/queries";
import {
  getAddablePlayersForTournament,
  getPairingsForTournament,
  getTournamentById,
  getUnassignedRoundsForTournament,
} from "@/lib/tournaments/queries";
import { getCurrentUser } from "@/lib/users/queries";
import { PairingBoard } from "./_components/pairing-board";

type EditTournamentPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

const editTabValues = ["players", "details"] as const;

export default async function EditTournamentPage({
  params,
}: EditTournamentPageProps) {
  const [{ id }, currentUser] = await Promise.all([params, getCurrentUser()]);

  const tournamentId = Number(id);
  if (!Number.isInteger(tournamentId) || tournamentId <= 0) notFound();

  const tournament = await getTournamentById(tournamentId);
  if (!tournament) notFound();
  if (!currentUser?.isAdmin) redirect(`/tournaments/${tournamentId}`);

  const [addablePlayers, clubs, courses, pairings, unassigned] =
    await Promise.all([
      getAddablePlayersForTournament(tournamentId),
      getAllClubsWithSeasons(),
      getCoursesWithTees(),
      getPairingsForTournament(tournamentId),
      getUnassignedRoundsForTournament(tournamentId),
    ]);

  return (
    <PageContent className="max-w-3xl">
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center gap-2">
          <div className="flex flex-col">
            <h1 className="text-2xl font-semibold tracking-normal">
              Edit tournament
            </h1>
            <p className="text-sm text-muted-foreground">
              {tournament.clubName} · Season {tournament.season}
            </p>
          </div>

          <Button asChild variant="secondary" size="xl">
            <Link href={`/tournaments/${tournamentId}`}>
              <HugeiconsIcon icon={ArrowLeft02Icon} data-icon="inline-start" />
              Back
            </Link>
          </Button>
        </div>
        <CourseHero
          courseName={tournament.courseName}
          courseImgUrl={tournament.courseImgUrl}
          date={tournament.date}
        />
      </div>

      <UrlTabs
        defaultValue="players"
        values={editTabValues}
        className="w-full"
      >
        <TabsList size="lg" className="mb-3 w-full sm:w-fit">
          <TabsTrigger
            value="players"
            className="flex-1 sm:flex-none"
          >
            Players
          </TabsTrigger>
          <TabsTrigger
            value="details"
            className="flex-1 sm:flex-none"
          >
            Details
          </TabsTrigger>
        </TabsList>

        <TabsContent value="players">
          <PairingBoard
            tournamentId={tournamentId}
            addablePlayers={addablePlayers}
            pairings={pairings}
            unassigned={unassigned}
          />
        </TabsContent>

        {/* forceMount so a half-finished edit survives a trip to another tab. */}
        <TabsContent value="details" forceMount className="data-[state=inactive]:hidden">
          <TournamentForm
            surface="page"
            mode="edit"
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
        </TabsContent>
      </UrlTabs>
    </PageContent>
  );
}
