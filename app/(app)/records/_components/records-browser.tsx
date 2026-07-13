import { HugeiconsIcon } from "@hugeicons/react";
import { GolfHoleIcon } from "@hugeicons/core-free-icons";

import { Card, CardContent } from "@/components/ui/card";
import { GreenieCard } from "@/components/greenie-card";
import { displayName, getInitials } from "@/components/player-card";
import { WinnerCard } from "@/components/winner-card";
import { formatDate } from "@/lib/dates";

type Round = {
  roundId: number;
  date: Date;
  totalStrokes: number;
  courseName: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  email: string | null;
  image: string | null;
};

type Greenie = {
  roundId: number;
  hole: number;
  feet: number;
  inches: number;
  roundDate: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  image: string | null;
  courseId: number;
  courseHandle: string;
  courseName: string;
  courseImgUrl: string | null;
  clubName: string | null;
  season: number | null;
};

export function RecordsBrowser({
  greenies,
  rounds,
}: {
  greenies: Greenie[];
  rounds: Round[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-normal">Best Rounds</h2>

        {rounds.length === 0 ? (
          <EmptyGreeniesState message="No complete rounds have been recorded yet." />
        ) : (
          <RoundsGrid rounds={rounds} />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-normal">
          Closest Greenies
        </h2>

        {greenies.length === 0 ? (
          <EmptyGreeniesState message="No greenies have been recorded yet." />
        ) : (
          <GreeniesGrid greenies={greenies} />
        )}
      </section>
    </div>
  );
}

function RoundsGrid({ rounds }: { rounds: Round[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {rounds.map((round) => (
        <WinnerCard
          key={round.roundId}
          playerName={displayName(round)}
          initials={getInitials(round)}
          image={round.image}
          secondary={
            <>
              <span className="truncate">{round.courseName}</span>
              <span>{formatDate(round.date, "shorter")}</span>
            </>
          }
          primaryValue={round.totalStrokes}
          href={`/rounds/${round.roundId}`}
        />
      ))}
    </div>
  );
}

function GreeniesGrid({ greenies }: { greenies: Greenie[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {greenies.map((greenie) => (
        <GreenieCard
          key={`${greenie.roundId}-${greenie.hole}`}
          greenie={greenie}
          courseName={greenie.courseName}
          href={`/rounds/${greenie.roundId}`}
        />
      ))}
    </div>
  );
}

function EmptyGreeniesState({ message }: { message: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <HugeiconsIcon icon={GolfHoleIcon} size={20} aria-hidden />
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
