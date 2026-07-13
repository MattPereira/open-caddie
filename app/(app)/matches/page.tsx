import type { Metadata } from "next";

import { appPageIcons } from "@/components/layout/app-nav-items";
import { PageContent } from "@/components/layout/page-content";
import { PageHeading } from "@/components/layout/page-heading";
import { getCoursesWithTees } from "@/lib/courses/queries";
import { getAllMatches } from "@/lib/matches/queries";
import { getAllUsers, getCurrentUser } from "@/lib/users/queries";
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
          description="Select a match to see the results"
        >
          Matches
        </PageHeading>
        {currentUser ? (
          <AddMatchButton courses={courses} players={players} />
        ) : null}
      </div>
      <MatchesBrowser
        matches={matches.map(
          ({ id, format, date, courseName, courseImgUrl, playerCount }) => ({
            id,
            format,
            date: date.toISOString().slice(0, 10),
            courseName,
            courseImgUrl,
            playerCount,
          }),
        )}
      />
    </PageContent>
  );
}
