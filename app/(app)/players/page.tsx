import type { Metadata } from "next";

import { appPageIcons } from "@/components/app-nav-items";
import { PageHeading } from "@/components/page-heading";
import { getAllUsers, getCurrentUser } from "@/db/queries/users";
import { AddPlayerButton } from "./_components/add-player-button";
import { PlayersBrowser } from "./_components/players-browser";

export const metadata: Metadata = {
  title: "Players",
};

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const [players, currentUser] = await Promise.all([
    getAllUsers(),
    getCurrentUser(),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex items-start gap-2">
        <PageHeading
          icon={appPageIcons.players}
          description="Select a player to view their profile"
        >
          Players
        </PageHeading>
        {currentUser?.isAdmin ? (
          <div className="ml-auto">
            <AddPlayerButton />
          </div>
        ) : null}
      </div>
      <PlayersBrowser players={players} />
    </main>
  );
}
