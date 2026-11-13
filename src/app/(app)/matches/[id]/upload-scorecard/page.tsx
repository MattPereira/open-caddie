import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PageContent } from "@/components/layout/page-content";
import { ScorecardUploadForm } from "@/components/features/scorecard-import/scorecard-upload-form";
import { getMatchById } from "@/lib/matches/queries";
import { getScorecardImportPlayers } from "@/lib/rounds/scorecard-import";
import { getCurrentPlayer } from "@/lib/players/queries";
import { uploadMatchRoundScorecard } from "@/app/(app)/matches/actions";
import { formatDate } from "@/lib/dates";

type UploadScorecardPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Upload scorecard",
};

export default async function MatchUploadScorecardPage({
  params,
}: UploadScorecardPageProps) {
  const { id } = await params;
  const matchId = Number(id);
  if (!Number.isInteger(matchId) || matchId <= 0) notFound();

  const [match, currentPlayer] = await Promise.all([
    getMatchById(matchId),
    getCurrentPlayer(),
  ]);

  if (!match) notFound();

  const players = currentPlayer
    ? await getScorecardImportPlayers(
        currentPlayer.id,
        "match",
        matchId,
        match.rounds,
      )
    : null;
  if (!currentPlayer || !players) redirect(`/matches/${matchId}`);
  const action = uploadMatchRoundScorecard.bind(null, matchId);

  return (
    <PageContent className="max-w-3xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal">
          Upload scorecard
        </h1>
        <p className="text-base text-muted-foreground">
          {[match.courseName, formatDate(match.date, "shorter")]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <ScorecardUploadForm
        action={action}
        cancelHref={`/matches/${matchId}`}
        draftStorageKey={`opencaddie:scorecardUpload:match:${matchId}`}
        players={players}
        uploadPathPrefix={`round-scorecards/${match.courseHandle}/${currentPlayer.id}/match-${matchId}`}
      />
    </PageContent>
  );
}
