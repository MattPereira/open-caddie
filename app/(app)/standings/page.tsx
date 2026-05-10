import type { Metadata } from "next";

import { appPageIcons } from "@/components/app-nav-items";
import { PageHeading } from "@/components/page-heading";

export const metadata: Metadata = {
  title: "Standings",
};

export default function StandingsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <PageHeading icon={appPageIcons.standings} description="Coming soon...">
        Standings
      </PageHeading>
    </main>
  );
}
