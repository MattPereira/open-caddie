import type { Metadata } from "next";

import { appPageIcons } from "@/components/app-nav-items";
import { PageContent } from "@/components/page-content";
import { PageHeading } from "@/components/page-heading";
import { getClosestGreenies } from "@/db/queries/greenies";
import { getLowestRounds } from "@/db/queries/rounds";
import { RecordsBrowser } from "./_components/records-browser";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Records",
};

export default async function RecordsPage() {
  const [greenies, rounds] = await Promise.all([
    getClosestGreenies(),
    getLowestRounds(),
  ]);

  return (
    <PageContent className="max-w-4xl">
      <PageHeading
        icon={appPageIcons.records}
        description="Browse all time lowest rounds and closest greenies"
      >
        Records
      </PageHeading>

      <RecordsBrowser
        rounds={rounds}
        greenies={greenies.map((greenie) => ({
          ...greenie,
          roundDate: greenie.roundDate.toISOString().slice(0, 10),
        }))}
      />
    </PageContent>
  );
}
