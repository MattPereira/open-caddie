import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GolfBatIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { CourseHero } from "@/components/course-hero";
import { RoundsTabContent } from "@/components/rounds-tab-content";
import { Button } from "@/components/ui/button";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UrlTabs } from "@/components/url-tabs";
import { getCoursesWithTees } from "@/db/queries/courses";
import { getMatchById } from "@/db/queries/matches";
import { getAllUsers, getCurrentUser } from "@/db/queries/users";
import { createPageMetadata } from "@/lib/metadata";
import { matchFormatLabel } from "@/lib/match-play";
import { formatDate } from "@/lib/utils";
import { PageContent } from "@/components/page-content";
import { UploadScorecardButton } from "@/components/upload-scorecard-button";
import { EditMatchButton } from "./_components/edit-match-button";
import { MatchPlayTabContent } from "./_components/match-play-tab-content";
import { SkinsTabContent } from "./_components/skins-tab-content";

type MatchPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    tab?: string;
  }>;
};

export const dynamic = "force-dynamic";

const matchTabValues = ["match", "skins", "rounds"] as const;

export async function generateMetadata({
  params,
}: MatchPageProps): Promise<Metadata> {
  const match = await getMatchFromParams(params);
  const format = matchFormatLabel(match?.format) ?? "Match Play";

  return createPageMetadata({
    title: format,
    description: match
      ? `${format} at ${match.courseName ?? "the course"} on ${formatDate(match.date, "short")}.`
      : "Match details on Open Caddie.",
  });
}

export default async function MatchPage({
  params,
  searchParams,
}: MatchPageProps) {
  const [match, currentUser, resolvedSearchParams] = await Promise.all([
    getMatchFromParams(params),
    getCurrentUser(),
    searchParams,
  ]);

  if (!match) notFound();

  const canManage =
    currentUser != null &&
    (currentUser.isAdmin || currentUser.id === match.createdByUserId);
  const currentUserRound = currentUser
    ? match.rounds.find((round) => round.userId === currentUser.id)
    : null;
  const canUploadScorecard = canManage || currentUserRound != null;
  const defaultTab = getMatchDefaultTab(resolvedSearchParams?.tab);

  const [courses, players] = canManage
    ? await Promise.all([getCoursesWithTees(), getAllUsers()])
    : [[], []];

  return (
    <PageContent className="max-w-5xl">
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal">
              Match Play
            </h1>
            {canManage ? (
              <EditMatchButton
                match={{
                  id: match.id,
                  date: match.date,
                  courseHandle: match.courseHandle,
                  courseName: match.courseName,
                  courseImgUrl: match.courseImgUrl,
                  format: match.format,
                  roundCount: match.rounds.length,
                  rounds: match.rounds.map((round) => ({
                    id: round.id,
                    userId: round.userId,
                    teeId: round.teeId,
                    email: null,
                    firstName: round.firstName,
                    lastName: round.lastName,
                    username: round.username,
                    image: round.image,
                  })),
                  teams: match.teams.map((team) => ({
                    id: team.id,
                    name: team.name,
                    rounds: team.rounds.map((round) => ({
                      id: round.id,
                      userId: round.userId,
                    })),
                  })),
                }}
                courses={courses}
                players={players}
              />
            ) : null}
          </div>

          {currentUserRound ? (
            <Button asChild size="lg">
              <Link href={`/rounds/${currentUserRound.id}/play`}>
                <HugeiconsIcon icon={GolfBatIcon} data-icon="inline-start" />
                Play
              </Link>
            </Button>
          ) : null}
        </div>
        <CourseHero
          courseName={match.courseName}
          courseImgUrl={match.courseImgUrl}
          date={match.date}
        />
      </div>

      <UrlTabs
        defaultValue={defaultTab}
        values={matchTabValues}
        className="w-full"
      >
        <TabsList className="mb-3 h-10! w-full p-1 sm:w-fit">
          <TabsTrigger
            value="match"
            className="flex-1 px-5 py-2 text-base sm:flex-none"
          >
            Match
          </TabsTrigger>
          <TabsTrigger
            value="skins"
            className="flex-1 px-5 py-2 text-base sm:flex-none"
          >
            Skins
          </TabsTrigger>
          <TabsTrigger
            value="rounds"
            className="flex-1 px-5 py-2 text-base sm:flex-none"
          >
            Rounds
          </TabsTrigger>
        </TabsList>

        <RoundsTabContent
          currentUser={currentUser}
          emptyMessage="No rounds have been recorded for this match."
          rounds={match.rounds}
          actions={
            canUploadScorecard ? (
              <UploadScorecardButton
                href={`/matches/${match.id}/upload-scorecard`}
              />
            ) : null
          }
        />
        <MatchPlayTabContent
          format={match.format}
          rounds={match.rounds}
          teams={match.teams}
        />
        <SkinsTabContent rounds={match.rounds} />
      </UrlTabs>
    </PageContent>
  );
}

function getMatchDefaultTab(tab: string | undefined) {
  return tab === "rounds" || tab === "skins" ? tab : "match";
}

async function getMatchFromParams(params: MatchPageProps["params"]) {
  const { id } = await params;
  const matchId = Number(id);

  if (!Number.isInteger(matchId) || matchId <= 0) {
    return null;
  }

  return getMatchById(matchId);
}
