"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SearchInput } from "@/components/search-input";

type Club = {
  handle: string;
  name: string;
  logo: string | null;
};

export function ClubsBrowser({ clubs }: { clubs: Club[] }) {
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
        wrapperClassName="w-full md:w-1/2"
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
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {filtered.map((club) => (
                <Card
                  key={club.handle}
                  className="gap-0 overflow-hidden py-0"
                >
                  <CardContent className="p-0">
                    <Link
                      href={`/clubs/${encodeURIComponent(club.handle)}`}
                      className="flex w-full items-center gap-3 p-4 text-left hover:bg-accent"
                    >
                      <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                        {club.logo ? (
                          <Image
                            src={club.logo}
                            alt={club.name}
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-base font-medium">
                          {club.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {club.handle}
                        </span>
                      </div>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
