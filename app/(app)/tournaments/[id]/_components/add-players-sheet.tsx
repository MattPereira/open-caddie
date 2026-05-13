"use client";

import { useMemo, useState, useTransition } from "react";
import { Tick02Icon, UserAdd02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  PlayerCard,
  displayName,
  type PlayerCardPlayer,
} from "@/components/player-card";
import { SearchInput } from "@/components/search-input";
import { addPlayersToTournament } from "../../actions";

export type AddablePlayer = PlayerCardPlayer & { id: string };

type AddPlayersSheetProps = {
  tournamentId: number;
  players: AddablePlayer[];
};

export function AddPlayersSheet({
  tournamentId,
  players,
}: AddPlayersSheetProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(
    () => filterPlayers(players, normalizedQuery),
    [players, normalizedQuery],
  );

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      setSelectedIds(new Set());
      setServerError(null);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onSubmit = () => {
    if (selectedIds.size === 0) return;
    setServerError(null);
    startTransition(async () => {
      const result = await addPlayersToTournament({
        tournamentId,
        userIds: Array.from(selectedIds),
      });
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      handleOpenChange(false);
    });
  };

  const count = selectedIds.size;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Add players">
          <HugeiconsIcon icon={UserAdd02Icon} />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex h-dvh w-full flex-col gap-0 overflow-hidden sm:max-w-md"
      >
        <SheetHeader className="shrink-0">
          <SheetTitle>Add players</SheetTitle>
          <SheetDescription>
            Select players to add to this tournament
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
          {players.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              All club members are already in this tournament.
            </p>
          ) : (
            <>
              <SearchInput
                placeholder="Search players..."
                value={query}
                onValueChange={setQuery}
              />

              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1 py-1">
                {filtered.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No players match your search.
                  </p>
                ) : (
                  filtered.map((player) => {
                    const selected = selectedIds.has(player.id);
                    return (
                      <div
                        key={player.id}
                        className={
                          selected
                            ? "relative rounded-xl ring-2 ring-primary"
                            : "relative rounded-xl"
                        }
                      >
                        <PlayerCard
                          player={player}
                          size="sm"
                          onClick={() => toggleSelected(player.id)}
                        />
                        {selected ? (
                          <div className="pointer-events-none absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <HugeiconsIcon icon={Tick02Icon} size={14} />
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {serverError ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </p>
          ) : null}
        </div>

        {players.length > 0 ? (
          <SheetFooter className="shrink-0">
            <Button
              type="button"
              onClick={onSubmit}
              disabled={count === 0 || isPending}
            >
              {isPending
                ? "Adding…"
                : `Add ${count} player${count === 1 ? "" : "s"}`}
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function filterPlayers(players: AddablePlayer[], query: string) {
  if (!query) return players;
  return players.filter((player) => {
    const haystack = [
      displayName(player),
      player.email ?? "",
      player.username ?? "",
      player.firstName ?? "",
      player.lastName ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}
