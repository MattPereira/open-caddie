import type { Metadata } from "next";

import { appPageIcons } from "@/components/layout/app-nav-items";
import { PageContent } from "@/components/layout/page-content";
import { PageHeading } from "@/components/layout/page-heading";
import { getAllClubsFull } from "@/lib/clubs/queries";
import { getCurrentPlayer } from "@/modules/players";
import { AddClubButton } from "./_components/add-club-button";
import { ClubsBrowser } from "./_components/clubs-browser";

export const metadata: Metadata = {
  title: "Clubs",
};

export const dynamic = "force-dynamic";

export default async function ClubsPage() {
  const [clubs, currentPlayer] = await Promise.all([
    getAllClubsFull(),
    getCurrentPlayer(),
  ]);

  return (
    <PageContent>
      <div className="flex items-start gap-2">
        <PageHeading
          icon={appPageIcons.clubs}
          description="Select a club to see season long standings"
        >
          Clubs
        </PageHeading>
        {currentPlayer?.isAdmin ? (
          <div className="ml-auto">
            <AddClubButton />
          </div>
        ) : null}
      </div>
      <ClubsBrowser clubs={clubs} />
    </PageContent>
  );
}
