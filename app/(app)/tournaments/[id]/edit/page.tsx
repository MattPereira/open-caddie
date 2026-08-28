import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UrlTabs } from "@/components/shared/url-tabs";
import { PageContent } from "@/components/layout/page-content";
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
import { formatDate } from "@/lib/dates";
import { PairingsManager } from "./_components/pairings-manager";
import { TournamentPlayers } from "./_components/tournament-players";

type EditTournamentPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

const editTabValues = ["players", "pairings", "details"] as const;

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
      <div className="flex items-start gap-2">
        <Button
          asChild
          variant="ghost"
          size="icon"
          aria-label="Back to tournament"
        >
          <Link href={`/tournaments/${tournamentId}`}>
            <HugeiconsIcon icon={ArrowLeft02Icon} aria-hidden />
          </Link>
        </Button>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-normal">
            Edit tournament
          </h1>
          <p className="text-base text-muted-foreground">
            {[tournament.courseName, formatDate(tournament.date, "shorter")]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      <UrlTabs
        defaultValue="players"
        values={editTabValues}
        className="w-full"
      >
        <TabsList className="w-full p-1 sm:w-fit mb-3 h-10!">
          <TabsTrigger
            value="players"
            className="flex-1 px-5 py-2 text-base sm:flex-none"
          >
            Players
          </TabsTrigger>
          <TabsTrigger
            value="pairings"
            className="flex-1 px-5 py-2 text-base sm:flex-none"
          >
            Pairings
          </TabsTrigger>
          <TabsTrigger
            value="details"
            className="flex-1 px-5 py-2 text-base sm:flex-none"
          >
            Details
          </TabsTrigger>
        </TabsList>

        <TabsContent value="players">
          <TournamentPlayers
            tournamentId={tournamentId}
            players={tournament.rounds}
            addablePlayers={addablePlayers}
          />
        </TabsContent>

        <TabsContent value="pairings">
          <PairingsManager
            tournamentId={tournamentId}
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
