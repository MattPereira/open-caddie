"use client";

import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/search-input";
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
        formatTournamentTime(t.startsAt),
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
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <SearchInput
          placeholder="Search tournaments…"
          value={query}
          onValueChange={setQuery}
          wrapperClassName="w-full md:w-1/2"
        />
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

function formatTournamentTime(time: string | null) {
  if (!time) return "";
  const [hours = "0", minutes = "0"] = time.split(":");
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2000, 0, 1, Number(hours), Number(minutes)));
}
