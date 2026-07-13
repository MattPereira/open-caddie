"use client";

import { useMemo, useState } from "react";

import { CardGrid } from "@/components/shared/card-grid";
import { PlayerCard } from "@/components/domain/player-card";
import { displayName } from "@/lib/players/player-name";
import { SearchInput } from "@/components/shared/search-input";
import { Card, CardContent } from "@/components/ui/card";

type ClubMember = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  image: string | null;
  isAdmin: boolean;
  roundsCount: number;
  greeniesCount: number;
};

export function ClubMembersBrowser({ members }: { members: ClubMember[] }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(
    () => filterMembers(members, normalizedQuery),
    [members, normalizedQuery],
  );

  return (
    <div className="flex flex-col gap-4">
      <SearchInput
        placeholder="Search members..."
        value={query}
        onValueChange={setQuery}
        wrapperClassName="w-full"
      />

      {members.length === 0 ? (
        <MembersEmptyState message="No members yet." />
      ) : filtered.length === 0 ? (
        <MembersEmptyState message="No members match your search." />
      ) : (
        <CardGrid>
          {filtered.map((member) => (
            <PlayerCard
              key={member.id}
              player={member}
              href={`/players/${encodeURIComponent(member.id)}`}
            />
          ))}
        </CardGrid>
      )}
    </div>
  );
}

function MembersEmptyState({ message }: { message: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-10 text-center text-sm text-muted-foreground">
        {message}
      </CardContent>
    </Card>
  );
}

function filterMembers(members: ClubMember[], query: string) {
  if (!query) return members;

  return members.filter((member) => {
    const haystack = [
      displayName(member),
      member.email ?? "",
      member.username ?? "",
      member.firstName ?? "",
      member.lastName ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}
