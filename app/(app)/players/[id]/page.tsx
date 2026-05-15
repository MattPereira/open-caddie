import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { displayName, getInitials } from "@/components/player-card";
import { StatTile } from "@/components/stat-tile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getCurrentUser,
  getUserById,
  getUserPlayingStatsById,
  getUserRoundsById,
} from "@/db/queries/users";
import { PlayerProfileActions } from "./_components/player-profile-actions";
import { PlayerRoundsBrowser } from "./_components/player-rounds-browser";

type PlayerPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PlayerPageProps): Promise<Metadata> {
  const player = await getPlayerFromParams(params);

  return {
    title: player ? displayName(player) : "Player",
  };
}

export default async function PlayerPage({ params }: PlayerPageProps) {
  const player = await getPlayerFromParams(params);

  if (!player) notFound();

  const [currentUser, stats, rounds] = await Promise.all([
    getCurrentUser(),
    getUserPlayingStatsById(player.id),
    getUserRoundsById(player.id),
  ]);
  const name = displayName(player);
  const canManageUsers = currentUser?.isAdmin ?? false;
  const canEdit = canManageUsers || currentUser?.id === player.id;

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-normal">Player</h1>
          {canEdit ? (
            <PlayerProfileActions
              player={player}
              canManageUsers={canManageUsers}
            />
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
            {player.image ? (
              <Image
                src={player.image}
                alt={name}
                fill
                sizes="96px"
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex size-full items-center justify-center text-xl font-medium text-muted-foreground">
                {getInitials(player)}
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="truncate text-xl font-medium tracking-normal">
              {name}
            </h2>
            <p className="truncate text-sm text-muted-foreground">
              {player.email ?? "-"}
            </p>
          </div>
        </div>
      </div>

      <Card className="py-3 lg:max-w-1/2">
        <CardHeader className="px-3">
          <CardTitle>Averages</CardTitle>
        </CardHeader>
        <CardContent className="px-3">
          <div className="grid grid-cols-3 gap-3">
            <StatTile
              label="Strokes"
              value={formatAverage(stats.averageStrokes)}
            />
            <StatTile label="Putts" value={formatAverage(stats.averagePutts)} />
            <StatTile
              label="Greenies"
              value={formatAverage(stats.averageGreeniesPerRound)}
            />
          </div>
        </CardContent>
      </Card>

      <PlayerRoundsBrowser
        rounds={rounds.map((round) => ({
          ...round,
          date: round.date.toISOString().slice(0, 10),
        }))}
      />
    </main>
  );
}

async function getPlayerFromParams(params: PlayerPageProps["params"]) {
  const { id } = await params;

  return getUserById(id);
}

function formatAverage(value: number | null) {
  return value == null ? "-" : value.toFixed(1);
}
