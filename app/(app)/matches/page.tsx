import type { Metadata } from "next";

import { appPageIcons } from "@/components/app-nav-items";
import { PageContent } from "@/components/page-content";
import { PageHeading } from "@/components/page-heading";
import { getCoursesWithTees } from "@/db/queries/courses";
import { getAllMatches } from "@/db/queries/matches";
import { getAllUsers, getCurrentUser } from "@/db/queries/users";
import { AddMatchButton } from "./_components/add-match-button";
import { MatchesBrowser } from "./_components/matches-browser";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Matches",
};

export default async function MatchesPage() {
  const [matches, currentUser] = await Promise.all([
    getAllMatches(),
    getCurrentUser(),
  ]);

  const [courses, players] = currentUser
    ? await Promise.all([getCoursesWithTees(), getAllUsers()])
    : [[], []];

  return (
    <PageContent>
      <div className="flex items-start justify-between gap-2">
        <PageHeading
          icon={appPageIcons.matches}
          description="Browse live, upcoming, and past casual matches"
        >
          Matches
        </PageHeading>
        {currentUser ? (
          <AddMatchButton courses={courses} players={players} />
        ) : null}
      </div>
      <MatchesBrowser
        matches={matches.map(({ id, format, date, startsAt, courseName, courseImgUrl, playerCount }) => ({
          id,
          format,
          date: date.toISOString().slice(0, 10),
          startsAt,
          courseName,
          courseImgUrl,
          playerCount,
        }))}
      />
    </PageContent>
  );
}
