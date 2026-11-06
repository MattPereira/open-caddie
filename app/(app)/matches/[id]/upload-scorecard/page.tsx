import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PageContent } from "@/components/layout/page-content";
import { ScorecardUploadForm } from "@/components/features/scorecard-import/scorecard-upload-form";
import { getMatchById } from "@/lib/matches/queries";
import { getScorecardImportPlayers } from "@/lib/rounds/scorecard-import";
import { getCurrentUser } from "@/lib/users/queries";
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

  const [match, currentUser] = await Promise.all([
    getMatchById(matchId),
    getCurrentUser(),
  ]);

  if (!match) notFound();

  const players = currentUser
    ? await getScorecardImportPlayers(
        currentUser.id,
        "match",
        matchId,
        match.rounds,
      )
    : null;
  if (!currentUser || !players) redirect(`/matches/${matchId}`);
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
        uploadPathPrefix={`round-scorecards/${match.courseHandle}/${currentUser.id}/match-${matchId}`}
      />
    </PageContent>
  );
}
