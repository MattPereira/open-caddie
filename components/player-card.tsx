import Link from "next/link";

import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { MediaCard } from "@/components/media-card";

export type PlayerCardPlayer = {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  image: string | null;
  isAdmin?: boolean;
  roundsCount?: number;
  greeniesCount?: number;
};

export function displayName(player: PlayerCardPlayer) {
  const full = [player.firstName, player.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return full || player.username || player.email || "Unnamed user";
}

export function getInitials(player: PlayerCardPlayer) {
  const first = player.firstName?.trim()?.[0];
  const last = player.lastName?.trim()?.[0];
  const initials = `${first ?? ""}${last ?? ""}`.toUpperCase();
  if (initials) return initials;
  const fallback = (player.username ?? player.email ?? "?").trim();
  return fallback.slice(0, 2).toUpperCase();
}

export function PlayerCard({
  player,
  href,
  onClick,
  size = "default",
}: {
  player: PlayerCardPlayer;
  href?: string;
  onClick?: () => void;
  size?: "default" | "sm";
}) {
  if (size === "sm") {
    return <CompactPlayerCard player={player} href={href} onClick={onClick} />;
  }

  const name = displayName(player);
  const stats: string[] = [];
  if (player.isAdmin) stats.push("Admin");
  if (player.roundsCount != null) {
    stats.push(
      `${player.roundsCount} ${player.roundsCount === 1 ? "round" : "rounds"}`,
    );
  }
  if (player.greeniesCount != null) {
    stats.push(
      `${player.greeniesCount} ${player.greeniesCount === 1 ? "greenie" : "greenies"}`,
    );
  }

  return (
    <MediaCard
      media={
        <div className="w-1/5 shrink-0">
          <AspectRatio
            ratio={1}
            className="overflow-hidden rounded-xl bg-muted"
          >
            <Avatar className="size-full rounded-none">
              {player.image ? (
                <AvatarImage src={player.image} alt={name} />
              ) : null}
              <AvatarFallback className="rounded-none text-lg">
                {getInitials(player)}
              </AvatarFallback>
            </Avatar>
          </AspectRatio>
        </div>
      }
      header={name}
      href={href}
      onClick={onClick}
    >
      {stats.length > 0 ? (
        <CardDescription className="truncate text-sm leading-snug">
          {stats.join(" · ")}
        </CardDescription>
      ) : null}
    </MediaCard>
  );
}

function CompactPlayerCard({
  player,
  href,
  onClick,
}: {
  player: PlayerCardPlayer;
  href?: string;
  onClick?: () => void;
}) {
  const name = displayName(player);
  const body = (
    <div className="flex w-full items-center gap-2.5 p-1.5 text-left">
      <Avatar className="size-9">
        {player.image ? <AvatarImage src={player.image} alt={name} /> : null}
        <AvatarFallback>{getInitials(player)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm font-medium">{name}</span>
        {player.isAdmin ? <Badge variant="outline">Admin</Badge> : null}
      </div>
    </div>
  );

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardContent className="p-0">
        {onClick ? (
          <button
            type="button"
            onClick={onClick}
            className="w-full hover:bg-accent"
          >
            {body}
          </button>
        ) : href ? (
          <Link href={href} className="block hover:bg-accent">
            {body}
          </Link>
        ) : (
          body
        )}
      </CardContent>
    </Card>
  );
}
