"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ClubOption = {
  id: number;
  handle: string;
  name: string;
};

export function StandingsFilters({
  clubs,
  selectedClubHandle,
  seasons,
  selectedSeason,
}: {
  clubs: ClubOption[];
  selectedClubHandle: string;
  seasons: number[];
  selectedSeason: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleClubChange(value: string) {
    const params = new URLSearchParams(searchParams);
    params.set("club", value);
    params.delete("season");
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSeasonChange(value: string) {
    const params = new URLSearchParams(searchParams);
    params.set("club", selectedClubHandle);
    params.set("season", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={selectedClubHandle} onValueChange={handleClubChange}>
        <SelectTrigger
          aria-label="Select club"
          id="standings-club"
          className="min-w-52"
        >
          <SelectValue placeholder="Club" />
        </SelectTrigger>
        <SelectContent>
          {clubs.map((club) => (
            <SelectItem key={club.id} value={club.handle}>
              {club.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={selectedSeason.toString()}
        onValueChange={handleSeasonChange}
      >
        <SelectTrigger
          aria-label="Select season"
          id="standings-season"
          className="min-w-32"
        >
          <SelectValue placeholder="Season" />
        </SelectTrigger>
        <SelectContent>
          {seasons.map((season) => (
            <SelectItem key={season} value={season.toString()}>
              Season {season}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
