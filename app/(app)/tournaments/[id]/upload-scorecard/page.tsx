import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PageContent } from "@/components/page-content";
import { ScorecardUploadForm } from "@/components/scorecard-upload-form";
import { getTournamentById } from "@/db/queries/tournaments";
import { getCurrentUser } from "@/db/queries/users";
import { uploadTournamentRoundScorecard } from "@/lib/actions/upload-round-scorecard";

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
  if (!currentUser?.isAdmin) redirect(`/tournaments/${tournamentId}`);

  const players = tournament.rounds.map((round) => ({
    roundId: round.id,
    userId: round.userId,
    firstName: round.firstName,
    lastName: round.lastName,
    username: round.username,
    image: round.image,
  }));
  const action = uploadTournamentRoundScorecard.bind(null, tournamentId);

  return (
    <PageContent className="max-w-3xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal">
          Upload scorecard
        </h1>
        <p className="text-base text-muted-foreground">
          {tournament.clubName}
        </p>
      </div>

      <ScorecardUploadForm
        action={action}
        cancelHref={`/tournaments/${tournamentId}`}
        players={players}
        uploadPathPrefix={`round-scorecards/${currentUser.id}/tournament-${tournamentId}`}
      />
    </PageContent>
  );
}
