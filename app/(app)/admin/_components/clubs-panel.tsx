"use client";

import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SearchInput } from "@/components/search-input";
import { ClubSheet, type AdminClub } from "./club-sheet";

type ClubsPanelProps = {
  clubs: AdminClub[];
};

export function ClubsPanel({ clubs }: ClubsPanelProps) {
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"create" | "edit">("create");
  const [activeClub, setActiveClub] = useState<AdminClub | undefined>();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clubs;
    return clubs.filter((c) =>
      [c.name, c.handle].join(" ").toLowerCase().includes(q),
    );
  }, [clubs, query]);

  const openCreate = () => {
    setSheetMode("create");
    setActiveClub(undefined);
    setSheetOpen(true);
  };

  const openEdit = (club: AdminClub) => {
    setSheetMode("edit");
    setActiveClub(club);
    setSheetOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          placeholder="Search clubs…"
          value={query}
          onValueChange={setQuery}
          wrapperClassName="flex-1 sm:max-w-sm"
        />
        <Button onClick={openCreate}>
          <HugeiconsIcon icon={Add01Icon} />
          Add club
        </Button>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No clubs match.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((club) => (
            <Card key={club.handle} className="gap-0 overflow-hidden py-0">
              <CardContent className="p-0">
                <button
                  type="button"
                  onClick={() => openEdit(club)}
                  className="flex w-full flex-col gap-1 p-4 text-left hover:bg-accent"
                >
                  <span className="text-base font-medium">{club.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {club.handle}
                  </span>
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ClubSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={sheetMode}
        club={activeClub}
      />
    </div>
  );
}
