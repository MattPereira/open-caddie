"use client";

import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserCircleIcon } from "@hugeicons/core-free-icons";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PlayerCard, displayName } from "@/components/player-card";
import { SearchInput } from "@/components/search-input";

type Player = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  image: string | null;
  isAdmin: boolean;
};

export function PlayersBrowser({ players }: { players: Player[] }) {
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(
    () => filterPlayers(players, normalizedQuery),
    [players, normalizedQuery],
  );

  return (
    <div className="flex flex-col gap-6">
      <SearchInput
        placeholder="Search players..."
        value={query}
        onValueChange={setQuery}
        wrapperClassName="w-full md:w-1/2"
      />

      {players.length === 0 ? (
        <EmptyPlayersState message="No players are available yet." />
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-normal">Players</h2>
            <Badge variant="secondary">{players.length}</Badge>
          </div>

          {filtered.length === 0 ? (
            <EmptyPlayersState message="No players match your search." />
          ) : (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {filtered.map((player) => (
                <PlayerCard key={player.id} player={player} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function EmptyPlayersState({ message }: { message: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <HugeiconsIcon icon={UserCircleIcon} size={20} aria-hidden />
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}

function filterPlayers(players: Player[], query: string) {
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
