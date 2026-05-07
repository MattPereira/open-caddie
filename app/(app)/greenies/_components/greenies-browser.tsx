"use client";

import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { GolfHoleIcon, RulerIcon } from "@hugeicons/core-free-icons";

import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MediaCard } from "@/components/media-card";
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
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
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
  const badges = [{ label: playerName }];

  if (greenie.season != null) {
    badges.push({ label: `Season ${greenie.season}` });
  }

  return (
    <MediaCard
      imageUrl={greenie.courseImgUrl}
      imageAlt={greenie.courseName}
      header={greenie.courseName}
      badges={badges}
    >
      <CardDescription className="grid grid-cols-2 gap-1.5 text-card-foreground">
        <GreenieDetail
          icon={GolfHoleIcon}
          label="Hole"
          value={`No. ${greenie.hole}`}
        />
        <GreenieDetail
          icon={RulerIcon}
          label="Distance"
          value={formatDistance(greenie)}
        />
      </CardDescription>
    </MediaCard>
  );
}

function GreenieDetail({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof HugeiconsIcon>["icon"];
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-1.5 rounded-lg bg-muted/50 p-1.5">
      <span className="mt-0.5 shrink-0 text-muted-foreground">
        <HugeiconsIcon icon={icon} size={13} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[11px] leading-none text-muted-foreground">
          {label}
        </span>
        <span className="truncate text-xs font-medium text-card-foreground">
          {value}
        </span>
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
      `No. ${greenie.hole}`,
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
      greenies: [...seasonGreenies].sort(compareGreenieDistance).slice(0, 4),
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

function formatDistance(greenie: Pick<Greenie, "feet" | "inches">) {
  if (greenie.inches === 0) {
    return `${greenie.feet} ft`;
  }

  return `${greenie.feet} ft ${greenie.inches} in`;
}
