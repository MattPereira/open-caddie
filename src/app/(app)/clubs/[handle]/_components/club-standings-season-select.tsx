"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ClubStandingsSeasonSelect({
  seasons,
  selectedSeason,
}: {
  seasons: number[];
  selectedSeason: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleSeasonChange(value: string) {
    const params = new URLSearchParams(searchParams);
    params.set("season", value);
    params.delete("club");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select
      value={selectedSeason.toString()}
      onValueChange={handleSeasonChange}
    >
      <SelectTrigger
        aria-label="Select season"
        id="club-standings-season"
        className="min-w-32"
      >
        <SelectValue placeholder="Season" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {seasons.map((season) => (
            <SelectItem key={season} value={season.toString()}>
              Season {season}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
