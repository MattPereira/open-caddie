"use client";

import { useMemo, useState } from "react";
import { GolfHoleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import type { MatchFormat } from "@/db/schema";
import { CardGrid } from "@/components/shared/card-grid";
import { EventCard } from "@/components/domain/event-card";
import { SearchInput } from "@/components/shared/search-input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { matchFormatLabel } from "@/lib/matches";
import { formatDate } from "@/lib/dates";

type Match = {
  id: number;
  date: string;
  format: MatchFormat | null;
  courseName: string | null;
  courseImgUrl: string | null;
  playerCount: number;
};

type MatchStatus = "live" | "upcoming" | "past";

type MatchGroup = {
  status: MatchStatus;
  label: string;
  matches: Match[];
};

export function MatchesBrowser({ matches }: { matches: Match[] }) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => groupMatches(matches), [matches]);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleGroups = groups.filter((group) => group.matches.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <SearchInput
        placeholder="Search matches..."
        value={query}
        onValueChange={setQuery}
        wrapperClassName="w-full"
      />

      {visibleGroups.length === 0 ? (
        <EmptyMatchesState message="No matches are scheduled yet." />
      ) : (
        visibleGroups.map((group) => {
          const filtered = filterMatches(group.matches, normalizedQuery);

          return (
            <section key={group.status} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold tracking-normal">
                  {group.label}
                </h2>
                <Badge variant="secondary">{group.matches.length}</Badge>
              </div>

              {filtered.length === 0 ? (
                <EmptyMatchesState
                  message={`No ${group.label.toLowerCase()} matches your search.`}
                />
              ) : (
                <CardGrid>
                  {filtered.map((match) => (
                    <EventCard
                      key={match.id}
                      event={{
                        title: matchFormatLabel(match.format),
                        date: match.date,
                        courseName: match.courseName,
                        courseImgUrl: match.courseImgUrl,
                        playerCount: match.playerCount,
                      }}
                      href={`/matches/${match.id}`}
                    />
                  ))}
                </CardGrid>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}

function EmptyMatchesState({ message }: { message: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <HugeiconsIcon icon={GolfHoleIcon} aria-hidden />
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}

function groupMatches(matches: Match[]): MatchGroup[] {
  const today = getLocalDateKey(new Date());
  const live: Match[] = [];
  const upcoming: Match[] = [];
  const past: Match[] = [];

  for (const match of matches) {
    if (match.date === today) {
      live.push(match);
    } else if (match.date > today) {
      upcoming.push(match);
    } else {
      past.push(match);
    }
  }

  live.sort(sortAscending);
  upcoming.sort(sortAscending);
  past.sort(sortDescending);

  return [
    { status: "live", label: "Live", matches: live },
    { status: "upcoming", label: "Upcoming", matches: upcoming },
    { status: "past", label: "Past", matches: past },
  ];
}

function filterMatches(matches: Match[], query: string) {
  if (!query) return matches;

  return matches.filter((match) => {
    const haystack = [
      matchFormatLabel(match.format) ?? "",
      match.courseName ?? "",
      formatDate(match.date, "short"),
      match.date,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

function sortAscending(a: Match, b: Match) {
  return compareMatchDateTime(a, b);
}

function sortDescending(a: Match, b: Match) {
  return compareMatchDateTime(b, a);
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function compareMatchDateTime(a: Match, b: Match) {
  return a.date.localeCompare(b.date);
}
