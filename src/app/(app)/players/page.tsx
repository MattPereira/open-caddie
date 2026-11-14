import type { Metadata } from "next";

import { appPageIcons } from "@/components/layout/app-nav-items";
import { PageContent } from "@/components/layout/page-content";
import { PageHeading } from "@/components/layout/page-heading";
import { getAllPlayers, getCurrentPlayer } from "@/modules/players";
import { AddPlayerButton } from "./_components/add-player-button";
import { PlayersBrowser } from "./_components/players-browser";

export const metadata: Metadata = {
  title: "Players",
};

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const [players, currentPlayer] = await Promise.all([
    getAllPlayers(),
    getCurrentPlayer(),
  ]);

  return (
    <PageContent>
      <div className="flex items-start gap-2">
        <PageHeading
          icon={appPageIcons.players}
          description="Select a player to view their round history"
        >
          Players
        </PageHeading>
        {currentPlayer?.isAdmin ? (
          <div className="ml-auto">
            <AddPlayerButton />
          </div>
        ) : null}
      </div>
      <PlayersBrowser players={players} />
    </PageContent>
  );
}
