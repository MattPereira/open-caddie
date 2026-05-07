"use client";

import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { GolfHoleIcon } from "@hugeicons/core-free-icons";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
        />
      ))}
    </div>
  );
}

function GreenieCard({ greenie }: { greenie: Greenie }) {
  const playerName = formatPlayerName(greenie);

  return (
    <Card size="sm" className="gap-0 py-0!">
      <CardContent className="flex items-center gap-3 p-2!">
        <Avatar className="size-15 rounded-lg">
          {greenie.image ? (
            <AvatarImage src={greenie.image} alt={playerName} />
          ) : null}
          <AvatarFallback className="rounded-lg">
            {getInitials(greenie)}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          <CardTitle className="truncate">{playerName}</CardTitle>
          <span className="truncate text-xs text-muted-foreground">
            {greenie.courseName}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <GreenieStat label="Hole" value={greenie.hole} />
          <GreenieStat label="Distance" value={formatDistance(greenie)} />
        </div>
      </CardContent>
    </Card>
  );
}

function GreenieStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex min-w-16 flex-col gap-0.5 rounded-md bg-muted px-3 py-1.5">
      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <span>{label}</span>
      </div>
      <span className="text-end text-sm font-semibold tabular-nums text-card-foreground">
        {value}
      </span>
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
      formatPlayerName(greenie),
      greenie.courseName,
      greenie.courseHandle,
      greenie.clubName ?? "",
      greenie.season != null ? `Season ${greenie.season}` : "",
      `Hole ${greenie.hole}`,
      `${greenie.hole}`,
      formatDistance(greenie),
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

function formatPlayerName(greenie: Greenie) {
  const fullName = [greenie.firstName, greenie.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || greenie.username || "Unknown player";
}

function getInitials(greenie: Greenie) {
  const first = greenie.firstName?.trim()?.[0];
  const last = greenie.lastName?.trim()?.[0];
  const initials = `${first ?? ""}${last ?? ""}`.toUpperCase();
  if (initials) return initials;
  const fallback = (greenie.username ?? "?").trim();
  return fallback.slice(0, 2).toUpperCase();
}

function formatDistance(greenie: Pick<Greenie, "feet" | "inches">) {
  if (greenie.inches === 0) {
    return `${greenie.feet}'`;
  }

  return `${greenie.feet}' ${greenie.inches}"`;
}
