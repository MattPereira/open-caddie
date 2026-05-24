"use client";

import { useMemo, useState } from "react";

import { CardGrid } from "@/components/card-grid";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ClubCard, type ClubCardClub } from "@/components/club-card";
import { SearchInput } from "@/components/search-input";

export function ClubsBrowser({ clubs }: { clubs: ClubCardClub[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clubs;
    return clubs.filter((c) =>
      [c.name, c.handle].join(" ").toLowerCase().includes(q),
    );
  }, [clubs, query]);

  return (
    <div className="flex flex-col gap-6">
      <SearchInput
        placeholder="Search clubs..."
        value={query}
        onValueChange={setQuery}
        wrapperClassName="w-full"
      />

      {clubs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No clubs yet.
          </CardContent>
        </Card>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-normal">Clubs</h2>
            <Badge variant="secondary">{clubs.length}</Badge>
          </div>

          {filtered.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No clubs match your search.
              </CardContent>
            </Card>
          ) : (
            <CardGrid>
              {filtered.map((club) => (
                <ClubCard
                  key={club.handle}
                  club={club}
                  href={`/clubs/${encodeURIComponent(club.handle)}`}
                />
              ))}
            </CardGrid>
          )}
        </section>
      )}
    </div>
  );
}
