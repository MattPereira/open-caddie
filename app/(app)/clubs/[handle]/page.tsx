import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { GolfBatIcon, UserMultipleIcon } from "@hugeicons/core-free-icons";

import { ClubStandingsSeasonSelect } from "@/app/(app)/clubs/[handle]/_components/club-standings-season-select";
import { ClubMembersBrowser } from "@/app/(app)/clubs/[handle]/_components/club-members-browser";
import { PointRulesSummary } from "@/app/(app)/clubs/[handle]/_components/point-rules-summary";
import { appPageIcons } from "@/components/layout/app-nav-items";
import { StandingsTable } from "@/components/features/standings/standings-table";
import { Badge } from "@/components/ui/badge";
import { getClubByHandle, getClubMembersByHandle } from "@/db/queries/clubs";
import { getClubSeasons, getSeasonStandings } from "@/db/queries/standings";
import { getCurrentUser } from "@/db/queries/users";
import { PageContent } from "@/components/layout/page-content";
import { EditClubButton } from "../_components/edit-club-button";

type ClubPageProps = {
  params: Promise<{
    handle: string;
  }>;
  searchParams: Promise<{
    season?: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: ClubPageProps): Promise<Metadata> {
  const club = await getClubFromParams(params);

  return {
    title: club?.name ?? "Club",
  };
}

export default async function ClubPage({
  params,
  searchParams,
}: ClubPageProps) {
  const club = await getClubFromParams(params);

  if (!club) notFound();

  const [{ season: requestedSeason }, currentUser, members, seasons] =
    await Promise.all([
      searchParams,
      getCurrentUser(),
      getClubMembersByHandle(club.handle),
      getClubSeasons(club.id),
    ]);
  const seasonOptions = seasons.map((season) => season.season);
  const selectedSeason = getSelectedSeason(requestedSeason, seasonOptions);
  const standings =
    selectedSeason == null
      ? null
      : await getSeasonStandings({
          clubId: club.id,
          season: selectedSeason,
        });

  return (
    <PageContent>
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-normal">
            {club.name}
          </h1>
          {currentUser?.isAdmin ? <EditClubButton club={club} /> : null}
        </div>

        <div className="flex flex-col gap-6">
          <ClubLogo src={club.logo} alt={club.name} />
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-normal">
            <HugeiconsIcon
              icon={appPageIcons.standings}
              className="size-5"
              aria-hidden
            />
            Standings
          </h2>
          {selectedSeason != null && seasonOptions.length > 0 ? (
            <ClubStandingsSeasonSelect
              seasons={seasonOptions}
              selectedSeason={selectedSeason}
            />
          ) : null}
        </div>
        <div className="grid min-w-0 gap-3 lg:inline-grid lg:max-w-180">
          <PointRulesSummary pointRules={club.pointRules} />
          {standings ? <StandingsTable standings={standings} /> : null}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-normal">
            <HugeiconsIcon
              icon={UserMultipleIcon}
              className="size-5"
              aria-hidden
            />
            Members
          </h2>
          <Badge variant="secondary">{members.length}</Badge>
        </div>
        <ClubMembersBrowser members={members} />
      </section>
    </PageContent>
  );
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

async function getClubFromParams(params: ClubPageProps["params"]) {
  const { handle } = await params;

  return getClubByHandle(decodeURIComponent(handle));
}

function ClubLogo({ src, alt }: { src: string | null; alt: string }) {
  return (
    <div className="relative h-56 w-full overflow-hidden rounded-lg border bg-background sm:h-64 lg:h-72">
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="100vw"
          className="object-contain p-6"
          priority
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <HugeiconsIcon icon={GolfBatIcon} size={40} aria-hidden />
        </div>
      )}
    </div>
  );
}
