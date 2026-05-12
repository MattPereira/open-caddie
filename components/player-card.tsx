import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StatTile } from "@/components/stat-tile";

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
  const name = displayName(player);
  const showStats =
    player.roundsCount !== undefined || player.greeniesCount !== undefined;
  const compact = size === "sm";
  const body = (
    <div
      className={
        compact
          ? "flex w-full items-center gap-2.5 p-1.5 text-left"
          : "flex w-full items-center gap-3 p-2 text-left"
      }
    >
      <Avatar className={compact ? "size-9" : "size-18"}>
        {player.image ? <AvatarImage src={player.image} alt={name} /> : null}
        <AvatarFallback>{getInitials(player)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span
            className={
              compact ? "truncate text-sm font-medium" : "truncate font-medium"
            }
          >
            {name}
          </span>
          {player.isAdmin ? <Badge variant="outline">Admin</Badge> : null}
        </div>
        <span
          className={
            compact
              ? "truncate text-[11px] text-muted-foreground"
              : "truncate text-xs text-muted-foreground"
          }
        >
          {player.email ?? "—"}
        </span>
      </div>
      {showStats ? (
        <div className="flex flex-col shrink-0 items-center gap-1.5">
          <StatTile label="Rounds" value={player.roundsCount ?? 0} />
          <StatTile label="Greenies" value={player.greeniesCount ?? 0} />
        </div>
      ) : null}
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
