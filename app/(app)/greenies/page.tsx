import type { Metadata } from "next";

import { appPageIcons } from "@/components/app-nav-items";
import { PageContent } from "@/components/page-content";
import { PageHeading } from "@/components/page-heading";
import { getAllGreenies } from "@/db/queries/greenies";
import { GreeniesBrowser } from "./_components/greenies-browser";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Greenies",
};

export default async function GreeniesPage() {
  const greenies = await getAllGreenies();

  return (
    <PageContent className="max-w-4xl">
      <PageHeading
        icon={appPageIcons.greenies}
        description="Browse the closest to the pin shots on par 3s"
      >
        Greenies
      </PageHeading>

      <GreeniesBrowser
        greenies={greenies.map((greenie) => ({
          ...greenie,
          roundDate: greenie.roundDate.toISOString().slice(0, 10),
        }))}
      />
    </PageContent>
  );
}
