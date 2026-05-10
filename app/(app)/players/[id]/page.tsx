import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { displayName, getInitials } from "@/components/player-card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getCurrentUser, getUserById } from "@/db/queries/users";
import { PlayerProfileActions } from "./_components/player-profile-actions";

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
  const [player, currentUser] = await Promise.all([
    getPlayerFromParams(params),
    getCurrentUser(),
  ]);

  if (!player) notFound();

  const name = displayName(player);
  const canManageUsers = currentUser?.isAdmin ?? false;
  const canEdit = canManageUsers || currentUser?.id === player.id;

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex justify-between">
        <h1 className="text-2xl font-semibold tracking-normal">Player</h1>

        {canEdit ? (
          <PlayerProfileActions
            player={player}
            canManageUsers={canManageUsers}
          />
        ) : null}
      </div>
      <div className="flex items-center gap-4">
        <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
          <AspectRatio ratio={1} className="size-full">
            <Avatar className="size-full rounded-lg">
              {player.image ? (
                <AvatarImage src={player.image} alt={name} />
              ) : null}
              <AvatarFallback className="text-lg font-medium">
                {getInitials(player)}
              </AvatarFallback>
            </Avatar>
          </AspectRatio>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="truncate text-xl font-semibold tracking-normal">
            {name}
          </h2>
          <p className="truncate text-sm text-muted-foreground">
            {player.email ?? "-"}
          </p>
        </div>
      </div>
    </main>
  );
}

async function getPlayerFromParams(params: PlayerPageProps["params"]) {
  const { id } = await params;

  return getUserById(id);
}
