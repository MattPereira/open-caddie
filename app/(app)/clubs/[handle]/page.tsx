import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft02Icon,
  ChampionIcon,
  GolfBatIcon,
} from "@hugeicons/core-free-icons";

import { TournamentsBrowser } from "@/app/(app)/tournaments/_components/tournaments-browser";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getClubByHandle } from "@/db/queries/clubs";
import { getTournamentsByClubHandle } from "@/db/queries/tournaments";
import { getCurrentUser } from "@/db/queries/users";
import type { PointRules } from "@/lib/point-rules-schema";
import { EditClubButton } from "../_components/edit-club-button";

type ClubPageProps = {
  params: Promise<{
    handle: string;
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

export default async function ClubPage({ params }: ClubPageProps) {
  const club = await getClubFromParams(params);

  if (!club) notFound();

  const [currentUser, tournaments] = await Promise.all([
    getCurrentUser(),
    getTournamentsByClubHandle(club.handle),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <Button asChild variant="ghost" className="w-fit px-0">
        <Link href="/clubs">
          <HugeiconsIcon icon={ArrowLeft02Icon} data-icon="inline-start" />
          Clubs
        </Link>
      </Button>

      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <PageHeading icon={GolfBatIcon} description={club.handle}>
            {club.name}
          </PageHeading>
          {currentUser?.isAdmin ? <EditClubButton club={club} /> : null}
        </div>

        <div className="relative size-24 overflow-hidden rounded-lg bg-muted">
          {club.logo ? (
            <Image
              src={club.logo}
              alt={club.name}
              fill
              sizes="96px"
              className="object-cover"
              priority
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <HugeiconsIcon icon={GolfBatIcon} size={32} aria-hidden />
            </div>
          )}
        </div>
      </div>

      <PointRulesSummary pointRules={club.pointRules} />

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-normal">
          <HugeiconsIcon icon={ChampionIcon} size={20} aria-hidden />
          Tournaments
        </h2>
        <TournamentsBrowser
          tournaments={tournaments.map((tournament) => ({
            ...tournament,
            date: tournament.date.toISOString().slice(0, 10),
          }))}
        />
      </section>
    </main>
  );
}

async function getClubFromParams(params: ClubPageProps["params"]) {
  const { handle } = await params;

  return getClubByHandle(decodeURIComponent(handle));
}

function PointRulesSummary({ pointRules }: { pointRules: PointRules }) {
  return (
    <Card className="lg:max-w-3xl">
      <CardHeader>
        <CardTitle>Point Rules</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <RuleStat label="Participation" value={pointRules.participation} />
          <RuleStat label="Pars" value={pointRules.pars} />
          <RuleStat label="Birdies" value={pointRules.birdies} />
          <RuleStat label="Eagles" value={pointRules.eagles} />
          <RuleStat label="Aces" value={pointRules.aces} />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <PositionRules
            label="Strokes"
            values={pointRules.strokes.positions}
          />
          <PositionRules label="Putts" values={pointRules.putts.positions} />
          <GreenieRules tiers={pointRules.greenies.tiers} />
        </div>
      </CardContent>
    </Card>
  );
}

function RuleStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function PositionRules({
  label,
  values,
}: {
  label: string;
  values: number[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{label}</h3>
      {values.length === 0 ? (
        <p className="text-sm text-muted-foreground">No position points.</p>
      ) : (
        <ol className="flex flex-col gap-1 text-sm">
          {values.map((value, index) => (
            <li key={index} className="flex justify-between gap-3">
              <span className="text-muted-foreground">#{index + 1}</span>
              <span className="font-medium tabular-nums">{value}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function GreenieRules({ tiers }: { tiers: PointRules["greenies"]["tiers"] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">Greenies</h3>
      <ol className="flex flex-col gap-1 text-sm">
        {tiers.map((tier, index) => (
          <li key={index} className="flex justify-between gap-3">
            <span className="text-muted-foreground">
              {tier.maxFt == null ? "No max" : `Within ${tier.maxFt} ft`}
            </span>
            <span className="font-medium tabular-nums">{tier.pts}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
