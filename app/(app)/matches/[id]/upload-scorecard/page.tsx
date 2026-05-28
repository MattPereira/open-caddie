import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PageContent } from "@/components/page-content";
import { ScorecardUploadForm } from "@/components/scorecard-upload-form";
import { getMatchById } from "@/db/queries/matches";
import { getCurrentUser } from "@/db/queries/users";
import { uploadMatchRoundScorecard } from "@/lib/actions/upload-round-scorecard";
import { formatDate } from "@/lib/utils";

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

  const canUpload =
    currentUser != null &&
    (currentUser.isAdmin ||
      currentUser.id === match.createdByUserId ||
      match.rounds.some((round) => round.userId === currentUser.id));
  if (!canUpload) redirect(`/matches/${matchId}`);

  const players = match.rounds.map((round) => ({
    roundId: round.id,
    userId: round.userId,
    firstName: round.firstName,
    lastName: round.lastName,
    username: round.username,
    image: round.image,
  }));
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
