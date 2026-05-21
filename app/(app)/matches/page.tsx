import type { Metadata } from "next";

import { appPageIcons } from "@/components/app-nav-items";
import { PageHeading } from "@/components/page-heading";
import { getCoursesWithTees } from "@/db/queries/courses";
import { getAllMatches } from "@/db/queries/matches";
import { getCurrentUser } from "@/db/queries/users";
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

  const courses = currentUser ? await getCoursesWithTees() : [];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex items-start justify-between gap-2">
        <PageHeading
          icon={appPageIcons.matches}
          description="Browse live, upcoming, and past casual matches"
        >
          Matches
        </PageHeading>
        {currentUser ? <AddMatchButton courses={courses} /> : null}
      </div>
      <MatchesBrowser
        matches={matches.map((match) => ({
          ...match,
          date: match.date.toISOString().slice(0, 10),
        }))}
      />
    </main>
  );
}
