"use client";

import { useMemo, useState } from "react";
import { GolfHoleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { RoundCard } from "@/components/round-card";
import { SearchInput } from "@/components/search-input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

type Round = {
  id: number;
  date: string;
  courseName: string | null;
  courseImgUrl: string | null;
  tournamentId: number | null;
  tournamentSeason: number | null;
  clubName: string | null;
  totalStrokes: number | null;
  totalPutts: number | null;
};

export function PlayerRoundsBrowser({ rounds }: { rounds: Round[] }) {
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(
    () => filterRounds(rounds, normalizedQuery),
    [rounds, normalizedQuery],
  );

  return (
    <div className="flex flex-col gap-6">
      {rounds.length === 0 ? (
        <EmptyRoundsState message="No rounds are available yet." />
      ) : (
        <section className="flex flex-col gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold tracking-normal">Rounds</h2>
              <Badge variant="secondary">{rounds.length}</Badge>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Select a round to view details or edit scores
            </p>
          </div>

          <SearchInput
            placeholder="Search rounds..."
            value={query}
            onValueChange={setQuery}
            wrapperClassName="w-full md:w-1/2 mb-2"
          />

          {filtered.length === 0 ? (
            <EmptyRoundsState message="No rounds match your search." />
          ) : (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {filtered.map((round) => (
                <RoundCard
                  key={round.id}
                  round={round}
                  href={`/rounds/${round.id}`}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function EmptyRoundsState({ message }: { message: string }) {
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

function filterRounds(rounds: Round[], query: string) {
  if (!query) return rounds;

  return rounds.filter((round) => {
    const haystack = [
      round.courseName ?? "",
      round.tournamentId == null ? "" : "Tournament",
      round.clubName ?? "",
      round.tournamentSeason == null ? "" : `Season ${round.tournamentSeason}`,
      formatDate(round.date, "short"),
      formatDate(round.date, "standard"),
      round.date,
      round.totalStrokes == null ? "" : `${round.totalStrokes} strokes`,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}
