"use client";

import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SearchInput } from "@/components/search-input";
import { SeasonSheet, type AdminSeason } from "./season-sheet";
import type { ClubOption } from "./tournament-sheet";

type SeasonsPanelProps = {
  seasons: AdminSeason[];
  clubs: ClubOption[];
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function SeasonsPanel({ seasons, clubs }: SeasonsPanelProps) {
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"create" | "edit">("create");
  const [activeSeason, setActiveSeason] = useState<AdminSeason | undefined>();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return seasons;
    return seasons.filter((s) => {
      const haystack = [
        s.clubName,
        `season ${s.number}`,
        `#${s.number}`,
        dateFormatter.format(s.startDate),
        dateFormatter.format(s.endDate),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [seasons, query]);

  const openCreate = () => {
    setSheetMode("create");
    setActiveSeason(undefined);
    setSheetOpen(true);
  };

  const openEdit = (season: AdminSeason) => {
    setSheetMode("edit");
    setActiveSeason(season);
    setSheetOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          placeholder="Search seasons…"
          value={query}
          onValueChange={setQuery}
          wrapperClassName="flex-1 sm:max-w-sm"
        />
        <Button onClick={openCreate} disabled={clubs.length === 0}>
          <HugeiconsIcon icon={Add01Icon} />
          Add season
        </Button>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No seasons match.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((season) => (
            <Card key={season.id} className="gap-0 overflow-hidden py-0">
              <CardContent className="p-0">
                <button
                  type="button"
                  onClick={() => openEdit(season)}
                  className="flex w-full flex-col gap-1 p-4 text-left hover:bg-accent"
                >
                  <span className="text-base font-medium">
                    Season {season.number}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {season.clubName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {dateFormatter.format(season.startDate)} –{" "}
                    {dateFormatter.format(season.endDate)}
                  </span>
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SeasonSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={sheetMode}
        season={activeSeason}
        clubs={clubs}
      />
    </div>
  );
}
