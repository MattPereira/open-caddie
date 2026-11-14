import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PageContent } from "@/components/layout/page-content";
import { ScorecardUploadForm } from "@/components/features/scorecard-import/scorecard-upload-form";
import { getScorecardImportPlayers } from "@/lib/rounds/scorecard-import";
import { getTournamentById } from "@/lib/tournaments/queries";
import { getCurrentPlayer } from "@/modules/players";
import { uploadTournamentRoundScorecard } from "@/app/(app)/tournaments/actions";
import { formatDate } from "@/lib/dates";

type UploadScorecardPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Upload scorecard",
};

export default async function TournamentUploadScorecardPage({
  params,
}: UploadScorecardPageProps) {
  const { id } = await params;
  const tournamentId = Number(id);
  if (!Number.isInteger(tournamentId) || tournamentId <= 0) notFound();

  const [tournament, currentPlayer] = await Promise.all([
    getTournamentById(tournamentId),
    getCurrentPlayer(),
  ]);

  if (!tournament) notFound();
  const players = currentPlayer
    ? await getScorecardImportPlayers(
        currentPlayer.id,
        "tournament",
        tournamentId,
        tournament.rounds,
      )
    : null;
  if (!currentPlayer || !players) redirect(`/tournaments/${tournamentId}`);
  const action = uploadTournamentRoundScorecard.bind(null, tournamentId);
  const uploadCourseHandle =
    tournament.courseHandle ?? `tournament-${tournamentId}`;

  return (
    <PageContent className="max-w-3xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal">
          Upload scorecard
        </h1>
        <p className="text-base text-muted-foreground">
          {[tournament.courseName, formatDate(tournament.date, "shorter")]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <ScorecardUploadForm
        action={action}
        cancelHref={`/tournaments/${tournamentId}`}
        draftStorageKey={`opencaddie:scorecardUpload:tournament:${tournamentId}`}
        players={players}
        uploadPathPrefix={`round-scorecards/${uploadCourseHandle}/${currentPlayer.id}/tournament-${tournamentId}`}
      />
    </PageContent>
  );
}
