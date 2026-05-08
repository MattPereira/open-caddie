import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getTournamentById } from "@/db/queries/tournaments";
import { formatDate } from "@/lib/utils";
import { GreeniesTabContent } from "./_components/greenies-tab-content";
import { RoundsTabContent } from "./_components/rounds-tab-content";
import { WinnersTabContent } from "./_components/winners-tab-content";

type TournamentPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: TournamentPageProps): Promise<Metadata> {
  const tournament = await getTournamentFromParams(params);

  return {
    title: tournament?.courseName ?? "Tournament",
  };
}

export default async function TournamentPage({ params }: TournamentPageProps) {
  const tournament = await getTournamentFromParams(params);

  if (!tournament) notFound();

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-normal">
          {tournament.courseName ?? "Course to be announced"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {formatDate(tournament.date, "long")}
        </p>
      </div>

      <Tabs defaultValue="rounds" className="w-full">
        <TabsList className="w-full p-1 sm:w-fit mb-3 h-10!">
          <TabsTrigger
            value="rounds"
            className="flex-1 px-5 py-2 text-lg sm:flex-none"
          >
            Rounds
          </TabsTrigger>
          <TabsTrigger
            value="greenies"
            className="flex-1 px-5 py-2 text-lg sm:flex-none"
          >
            Greenies
          </TabsTrigger>
          <TabsTrigger
            value="winners"
            className="flex-1 px-5 py-2 text-lg sm:flex-none"
          >
            Winners
          </TabsTrigger>
        </TabsList>

        <RoundsTabContent rounds={tournament.rounds} />
        <GreeniesTabContent greenies={tournament.greenies} />
        <WinnersTabContent rounds={tournament.rounds} />
      </Tabs>
    </main>
  );
}

async function getTournamentFromParams(params: TournamentPageProps["params"]) {
  const { id } = await params;
  const tournamentId = Number(id);

  if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
    return null;
  }

  return getTournamentById(tournamentId);
}
