import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PageContent } from "@/components/layout/page-content";
import { ScorecardUploadForm } from "@/components/features/scorecard-import/scorecard-upload-form";
import { getEventRoundAccess } from "@/lib/rounds/access";
import { getTournamentById } from "@/lib/tournaments/queries";
import { getCurrentUser } from "@/lib/users/queries";
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

  const [tournament, currentUser] = await Promise.all([
    getTournamentById(tournamentId),
    getCurrentUser(),
  ]);

  if (!tournament) notFound();
  const access = currentUser
    ? await getEventRoundAccess(currentUser.id, {
        kind: "tournament",
        id: tournamentId,
      })
    : null;
  if (!currentUser || !access?.canImportScorecard) {
    redirect(`/tournaments/${tournamentId}`);
  }

  // A Pairing mate is offered only their Pairing's Rounds; the import refuses
  // any other.
  const players = tournament.rounds
    .filter((round) => access.scorableRoundIds.includes(round.id))
    .map((round) => ({
      roundId: round.id,
      userId: round.userId,
      firstName: round.firstName,
      lastName: round.lastName,
      username: round.username,
      image: round.image,
    }));
  const action = uploadTournamentRoundScorecard.bind(null, tournamentId);
  const uploadCourseHandle = tournament.courseHandle ?? `tournament-${tournamentId}`;

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
        uploadPathPrefix={`round-scorecards/${uploadCourseHandle}/${currentUser.id}/tournament-${tournamentId}`}
      />
    </PageContent>
  );
}
