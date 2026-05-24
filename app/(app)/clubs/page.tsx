import type { Metadata } from "next";

import { appPageIcons } from "@/components/app-nav-items";
import { PageContent } from "@/components/page-content";
import { PageHeading } from "@/components/page-heading";
import { getAllClubsFull } from "@/db/queries/clubs";
import { getCurrentUser } from "@/db/queries/users";
import { AddClubButton } from "./_components/add-club-button";
import { ClubsBrowser } from "./_components/clubs-browser";

export const metadata: Metadata = {
  title: "Clubs",
};

export const dynamic = "force-dynamic";

export default async function ClubsPage() {
  const [clubs, currentUser] = await Promise.all([
    getAllClubsFull(),
    getCurrentUser(),
  ]);

  return (
    <PageContent>
      <div className="flex items-start gap-2">
        <PageHeading
          icon={appPageIcons.clubs}
          description="Browse clubs and their scoring rules"
        >
          Clubs
        </PageHeading>
        {currentUser?.isAdmin ? (
          <div className="ml-auto">
            <AddClubButton />
          </div>
        ) : null}
      </div>
      <ClubsBrowser clubs={clubs} />
    </PageContent>
  );
}
