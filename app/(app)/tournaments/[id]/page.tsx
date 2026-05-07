import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getTournamentById } from "@/db/queries/tournaments";

type TournamentPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

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

  if (!tournament) {
    notFound();
  }

  console.log({ tournament });

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-normal">
          {tournament.courseName ?? "Course to be announced"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {formatTournamentDate(tournament.date)}
        </p>
      </div>
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

function formatTournamentDate(date: Date) {
  return dateFormatter.format(date);
}
