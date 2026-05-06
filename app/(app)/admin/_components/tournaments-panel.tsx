"use client";

import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Search01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TournamentCard } from "@/components/tournament-card";
import {
  TournamentSheet,
  type AdminTournament,
  type ClubOption,
  type CourseOption,
} from "./tournament-sheet";

type TournamentsPanelProps = {
  tournaments: AdminTournament[];
  clubs: ClubOption[];
  courses: CourseOption[];
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function TournamentsPanel({
  tournaments,
  clubs,
  courses,
}: TournamentsPanelProps) {
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"create" | "edit">("create");
  const [activeTournament, setActiveTournament] = useState<
    AdminTournament | undefined
  >();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tournaments;
    return tournaments.filter((t) => {
      const haystack = [
        t.clubName,
        t.courseName ?? "",
        dateFormatter.format(t.date),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [tournaments, query]);

  const openCreate = () => {
    setSheetMode("create");
    setActiveTournament(undefined);
    setSheetOpen(true);
  };

  const openEdit = (tournament: AdminTournament) => {
    setSheetMode("edit");
    setActiveTournament(tournament);
    setSheetOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <HugeiconsIcon icon={Search01Icon} size={16} />
          </span>
          <Input
            type="search"
            placeholder="Search tournaments…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openCreate} disabled={clubs.length === 0}>
          <HugeiconsIcon icon={Add01Icon} />
          Add tournament
        </Button>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No tournaments match.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {filtered.map((tournament) => (
            <TournamentCard
              key={tournament.id}
              tournament={tournament}
              onClick={() => openEdit(tournament)}
            />
          ))}
        </div>
      )}

      <TournamentSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={sheetMode}
        tournament={activeTournament}
        clubs={clubs}
        courses={courses}
      />
    </div>
  );
}
