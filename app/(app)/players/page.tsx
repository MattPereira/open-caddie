import type { Metadata } from "next";

import { appPageIcons } from "@/components/app-nav-items";
import { PageHeading } from "@/components/page-heading";
import { getAllUsers } from "@/db/queries/users";
import { PlayersBrowser } from "./_components/players-browser";

export const metadata: Metadata = {
  title: "Players",
};

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const players = await getAllUsers();

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <PageHeading
        icon={appPageIcons.players}
        description="Select a player to view their profile"
      >
        Players
      </PageHeading>
      <PlayersBrowser players={players} />
    </main>
  );
}
