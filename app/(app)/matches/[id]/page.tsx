import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RoundsTabContent } from "@/components/rounds-tab-content";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCoursesWithTees } from "@/db/queries/courses";
import { getAddablePlayersForMatch, getMatchById } from "@/db/queries/matches";
import { getCurrentUser } from "@/db/queries/users";
import { formatDate } from "@/lib/utils";
import { AddPlayersSheet } from "./_components/add-players-sheet";
import { EditMatchButton } from "./_components/edit-match-button";
import { MatchPlayTabContent } from "./_components/match-play-tab-content";
import { SkinsTabContent } from "./_components/skins-tab-content";

type MatchPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: MatchPageProps): Promise<Metadata> {
  const match = await getMatchFromParams(params);

  return {
    title: match?.name || match?.courseName || "Match",
  };
}

export default async function MatchPage({ params }: MatchPageProps) {
  const [match, currentUser] = await Promise.all([
    getMatchFromParams(params),
    getCurrentUser(),
  ]);

  if (!match) notFound();

  const canManage =
    currentUser != null &&
    (currentUser.isAdmin || currentUser.id === match.createdByUserId);

  const [addablePlayers, courses] = canManage
    ? await Promise.all([
        getAddablePlayersForMatch(match.id),
        getCoursesWithTees(),
      ])
    : [[], []];
  const selectedCourse = courses.find(
    (course) => course.handle === match.courseHandle,
  );

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-normal">
            {match.name || "Match"}
          </h1>
          {canManage ? (
            <EditMatchButton
              match={{
                id: match.id,
                date: match.date,
                startsAt: match.startsAt,
                name: match.name,
                courseHandle: match.courseHandle,
                courseName: match.courseName,
                courseImgUrl: match.courseImgUrl,
              }}
              courses={courses}
            />
          ) : null}
          {canManage ? (
            <div className="ml-auto">
              <AddPlayersSheet
                matchId={match.id}
                players={addablePlayers}
                tees={selectedCourse?.tees ?? []}
              />
            </div>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {[match.courseName, formatDate(match.date, "short")]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <Tabs defaultValue="rounds" className="w-full">
        <TabsList className="mb-3 h-10! w-full p-1 sm:w-fit">
          <TabsTrigger
            value="match-play"
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
        />
        <MatchPlayTabContent rounds={match.rounds} />
        <SkinsTabContent rounds={match.rounds} />
      </Tabs>
    </main>
  );
}

async function getMatchFromParams(params: MatchPageProps["params"]) {
  const { id } = await params;
  const matchId = Number(id);

  if (!Number.isInteger(matchId) || matchId <= 0) {
    return null;
  }

  return getMatchById(matchId);
}
