import type { Metadata } from "next";

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
        <h1 className="text-2xl font-semibold tracking-normal">Greenies</h1>
        <div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Browse closest-to-the-pin results across recorded rounds.
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
