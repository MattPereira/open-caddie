import type { Metadata } from "next";

import { appPageIcons } from "@/components/app-nav-items";
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
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-2">
        <PageHeading icon={appPageIcons.greenies}>Greenies</PageHeading>
        <div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Browse the closest to the pin shots on par 3s
          </p>
        </div>
      </div>

      <GreeniesBrowser
        greenies={greenies.map((greenie) => ({
          ...greenie,
          roundDate: greenie.roundDate.toISOString().slice(0, 10),
        }))}
      />
    </main>
  );
}
