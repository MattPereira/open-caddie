"use client";

import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { GolfHoleIcon } from "@hugeicons/core-free-icons";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SearchInput } from "@/components/search-input";
import { TournamentCard } from "@/components/tournament-card";

type Tournament = {
  id: number;
  clubId: number;
  clubHandle: string;
  clubName: string;
  date: string;
  courseId: number | null;
  courseHandle: string | null;
  courseName: string | null;
  courseImgUrl: string | null;
};

type TournamentStatus = "live" | "upcoming" | "past";

type TournamentGroup = {
  status: TournamentStatus;
  label: string;
  tournaments: Tournament[];
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function TournamentsBrowser({
  tournaments,
}: {
  tournaments: Tournament[];
}) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => groupTournaments(tournaments), [tournaments]);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleGroups = groups.filter((group) => group.tournaments.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <SearchInput
        placeholder="Search tournaments..."
        value={query}
        onValueChange={setQuery}
        wrapperClassName="sm:w-80"
      />

      {visibleGroups.length === 0 ? (
        <EmptyTournamentsState message="No tournaments are scheduled yet." />
      ) : (
        visibleGroups.map((group) => {
          const filtered = filterTournaments(
            group.tournaments,
            normalizedQuery,
          );

          return (
            <section key={group.status} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold tracking-normal">
                  {group.label}
                </h2>
                <Badge variant="secondary">{group.tournaments.length}</Badge>
              </div>

              {filtered.length === 0 ? (
                <EmptyTournamentsState
                  message={`No ${group.label.toLowerCase()} tournaments match your search.`}
                />
              ) : (
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {filtered.map((tournament) => (
                    <TournamentCard
                      key={tournament.id}
                      tournament={tournament}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}

function EmptyTournamentsState({ message }: { message: string }) {
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

function groupTournaments(tournaments: Tournament[]): TournamentGroup[] {
  const today = getLocalDateKey(new Date());
  const live: Tournament[] = [];
  const upcoming: Tournament[] = [];
  const past: Tournament[] = [];

  for (const tournament of tournaments) {
    if (tournament.date === today) {
      live.push(tournament);
    } else if (tournament.date > today) {
      upcoming.push(tournament);
    } else {
      past.push(tournament);
    }
  }

  live.sort(sortAscending);
  upcoming.sort(sortAscending);
  past.sort(sortDescending);

  return [
    {
      status: "live",
      label: "Live",
      tournaments: live,
    },
    {
      status: "upcoming",
      label: "Upcoming",
      tournaments: upcoming,
    },
    {
      status: "past",
      label: "Past",
      tournaments: past,
    },
  ];
}

function filterTournaments(tournaments: Tournament[], query: string) {
  if (!query) return tournaments;

  return tournaments.filter((tournament) => {
    const haystack = [
      tournament.clubName,
      tournament.courseName ?? "",
      formatTournamentDate(tournament.date),
      tournament.date,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

function sortAscending(a: Tournament, b: Tournament) {
  return a.date.localeCompare(b.date);
}

function sortDescending(a: Tournament, b: Tournament) {
  return b.date.localeCompare(a.date);
}

function formatTournamentDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00.000Z`));
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
