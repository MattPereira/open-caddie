import type { Metadata } from "next";

import { PageHeading } from "@/components/page-heading";
import { StandingsTable } from "@/components/standings-table";
import { getAllClubs } from "@/db/queries/clubs";
import { getClubSeasons, getSeasonStandings } from "@/db/queries/standings";
import { appPageIcons } from "@/components/app-nav-items";
import { StandingsFilters } from "./_components/standings-season-select";

export const metadata: Metadata = {
  title: "Standings",
};

type StandingsPageProps = {
  searchParams: Promise<{ club?: string; season?: string }>;
};

export default async function StandingsPage({
  searchParams,
}: StandingsPageProps) {
  const [{ club: requestedClub, season: requestedSeason }, clubs] =
    await Promise.all([searchParams, getAllClubs()]);
  const selectedClub = getSelectedClub(requestedClub, clubs);
  const seasons = selectedClub ? await getClubSeasons(selectedClub.id) : [];
  const seasonOptions = seasons.map((season) => season.season);
  const selectedSeason = getSelectedSeason(requestedSeason, seasonOptions);
  const standings =
    selectedClub == null || selectedSeason == null
      ? null
      : await getSeasonStandings({
          clubId: selectedClub.id,
          season: selectedSeason,
        });

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <PageHeading
        icon={appPageIcons.standings}
        description="Browse season long rankings by club"
      >
        Standings
      </PageHeading>
      {selectedClub && selectedSeason != null && seasonOptions.length > 0 ? (
        <StandingsFilters
          clubs={clubs}
          selectedClubHandle={selectedClub.handle}
          seasons={seasonOptions}
          selectedSeason={selectedSeason}
        />
      ) : null}
      {standings ? <StandingsTable standings={standings} /> : null}
    </main>
  );
}

function getSelectedClub<TClub extends { handle: string }>(
  requestedClub: string | undefined,
  clubs: TClub[],
) {
  if (clubs.length === 0) return null;

  return clubs.find((club) => club.handle === requestedClub) ?? clubs[0];
}

function getSelectedSeason(
  requestedSeason: string | undefined,
  seasonOptions: number[],
) {
  if (seasonOptions.length === 0) return null;

  const parsed = requestedSeason == null ? null : Number(requestedSeason);
  if (
    parsed != null &&
    Number.isInteger(parsed) &&
    seasonOptions.includes(parsed)
  ) {
    return parsed;
  }

  return seasonOptions[0];
}
