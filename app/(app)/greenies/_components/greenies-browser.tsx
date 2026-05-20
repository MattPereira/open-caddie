"use client";

import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { GolfHoleIcon } from "@hugeicons/core-free-icons";

import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatGreenieDistance,
  formatGreeniePlayerName,
  GreenieCard,
} from "@/components/greenie-card";
import { SearchInput } from "@/components/search-input";

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

type GreenieGroup = {
  key: string;
  label: string;
  greenies: Greenie[];
};

export function GreeniesBrowser({ greenies }: { greenies: Greenie[] }) {
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();
  const visibleGreenies = useMemo(
    () => filterGreenies(greenies, normalizedQuery),
    [greenies, normalizedQuery],
  );
  const groups = useMemo(() => groupTopGreeniesBySeason(greenies), [greenies]);
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      greenies: filterGreenies(group.greenies, normalizedQuery),
    }))
    .filter((group) => group.greenies.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <Tabs defaultValue="closest" className="gap-6">
        <div className="flex flex-col items-start gap-3">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="closest">Closest</TabsTrigger>
          </TabsList>

          <SearchInput
            placeholder="Search greenies..."
            value={query}
            onValueChange={setQuery}
            wrapperClassName="w-full md:w-1/2"
          />
        </div>

        {greenies.length === 0 ? (
          <EmptyGreeniesState message="No greenies have been recorded yet." />
        ) : (
          <>
            <TabsContent value="all">
              {visibleGreenies.length === 0 ? (
                <EmptyGreeniesState message="No greenies match your search." />
              ) : (
                <GreeniesGrid greenies={visibleGreenies} />
              )}
            </TabsContent>

            <TabsContent value="closest" className="flex flex-col gap-6">
              {visibleGroups.length === 0 ? (
                <EmptyGreeniesState message="No greenies match your search." />
              ) : (
                visibleGroups.map((group) => (
                  <section key={group.key} className="flex flex-col gap-3">
                    <h2 className="text-lg font-semibold tracking-normal">
                      {group.label}
                    </h2>

                    <GreeniesGrid greenies={group.greenies} />
                  </section>
                ))
              )}
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}

function GreeniesGrid({ greenies }: { greenies: Greenie[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-3 2xl:grid-cols-3">
      {greenies.map((greenie) => (
        <GreenieCard
          key={`${greenie.roundId}-${greenie.hole}`}
          greenie={greenie}
          courseName={greenie.courseName}
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

function filterGreenies(greenies: Greenie[], query: string) {
  if (!query) return greenies;

  return greenies.filter((greenie) => {
    const haystack = [
      formatGreeniePlayerName(greenie),
      greenie.courseName,
      greenie.courseHandle,
      greenie.clubName ?? "",
      greenie.season != null ? `Season ${greenie.season}` : "",
      `Hole ${greenie.hole}`,
      `${greenie.hole}`,
      formatGreenieDistance(greenie),
      greenie.roundDate,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

function groupTopGreeniesBySeason(greenies: Greenie[]): GreenieGroup[] {
  const greeniesBySeason = new Map<number | null, Greenie[]>();

  for (const greenie of greenies) {
    const seasonGreenies = greeniesBySeason.get(greenie.season) ?? [];
    seasonGreenies.push(greenie);
    greeniesBySeason.set(greenie.season, seasonGreenies);
  }

  return Array.from(greeniesBySeason.entries())
    .sort(([seasonA], [seasonB]) => compareSeasons(seasonA, seasonB))
    .map(([season, seasonGreenies]) => ({
      key: season == null ? "no-season" : String(season),
      label: season == null ? "No season" : `Season ${season}`,
      greenies: [...seasonGreenies].sort(compareGreenieDistance).slice(0, 3),
    }));
}

function compareSeasons(a: number | null, b: number | null) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return b - a;
}

function compareGreenieDistance(a: Greenie, b: Greenie) {
  const feetCompare = a.feet - b.feet;
  if (feetCompare !== 0) return feetCompare;
  return a.inches - b.inches;
}
