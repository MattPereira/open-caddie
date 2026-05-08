import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GreenieCard } from "@/components/greenie-card";
import { displayName } from "@/components/player-card";
import { Card, CardContent } from "@/components/ui/card";
import { getRoundById } from "@/db/queries/rounds";
import { formatDate } from "@/lib/utils";
import { RoundScoresTable } from "../../tournaments/[id]/_components/round-scores-table";

type RoundPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: RoundPageProps): Promise<Metadata> {
  const round = await getRoundFromParams(params);
  const playerName = round ? displayName({ ...round, email: null }) : null;

  return {
    title: playerName ? `${playerName} Round` : "Round",
  };
}

export default async function RoundPage({ params }: RoundPageProps) {
  const round = await getRoundFromParams(params);

  if (!round) notFound();

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-normal">
          Round Details
        </h1>
        <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
          <span>{round.courseName}</span>
          <span className="hidden sm:inline" aria-hidden>
            /
          </span>
          <span>{formatDate(round.date, "long")}</span>
        </div>
      </div>

      <section className="flex min-w-0 flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-normal">Scores</h2>
        <RoundScoresTable rounds={[round]} />
      </section>

      <section className="flex min-w-0 flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-normal">Greenies</h2>
        {round.greenies.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No greenies have been recorded for this round.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3 2xl:grid-cols-3">
            {round.greenies.map((greenie) => (
              <GreenieCard
                key={`${greenie.roundId}-${greenie.hole}`}
                greenie={greenie}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

async function getRoundFromParams(params: RoundPageProps["params"]) {
  const { id } = await params;
  const roundId = Number(id);

  if (!Number.isInteger(roundId) || roundId <= 0) {
    return null;
  }

  return getRoundById(roundId);
}
