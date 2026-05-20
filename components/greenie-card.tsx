import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { CardDescription } from "@/components/ui/card";
import { MediaCard } from "@/components/media-card";

export type GreenieCardGreenie = {
  hole: number;
  feet: number;
  inches: number;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  image: string | null;
};

type GreenieCardProps = {
  greenie: GreenieCardGreenie;
  courseName?: string | null;
  details?: string;
};

export function GreenieCard({
  greenie,
  courseName,
  details,
}: GreenieCardProps) {
  const playerName = formatGreeniePlayerName(greenie);
  const subtext = [
    courseName ? clipCourseName(courseName) : null,
    details,
    `Hole ${greenie.hole}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <MediaCard
      media={
        <div className="w-1/5 shrink-0">
          <AspectRatio
            ratio={1}
            className="overflow-hidden rounded-xl bg-muted"
          >
            <Avatar className="size-full rounded-none">
              {greenie.image ? (
                <AvatarImage src={greenie.image} alt={playerName} />
              ) : null}
              <AvatarFallback className="rounded-none text-lg">
                {getInitials(greenie)}
              </AvatarFallback>
            </Avatar>
          </AspectRatio>
        </div>
      }
      header={playerName}
      endSlot={
        <div className="flex flex-col items-end leading-none">
          <span className="text-lg font-medium tabular-nums">
            {formatGreenieDistance(greenie)}
          </span>
          <span className="mt-1 text-sm text-muted-foreground">Dist</span>
        </div>
      }
    >
      <CardDescription className="truncate text-sm leading-snug">
        {subtext}
      </CardDescription>
    </MediaCard>
  );
}

export function formatGreeniePlayerName(greenie: GreenieCardGreenie) {
  const fullName = [greenie.firstName, greenie.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || greenie.username || "Unknown player";
}

function getInitials(greenie: GreenieCardGreenie) {
  const first = greenie.firstName?.trim()?.[0];
  const last = greenie.lastName?.trim()?.[0];
  const initials = `${first ?? ""}${last ?? ""}`.toUpperCase();
  if (initials) return initials;
  const fallback = (greenie.username ?? "?").trim();
  return fallback.slice(0, 2).toUpperCase();
}

function clipCourseName(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).join(" ");
}

export function formatGreenieDistance(
  greenie: Pick<GreenieCardGreenie, "feet" | "inches">,
) {
  if (greenie.inches === 0) {
    return `${greenie.feet}'`;
  }

  return `${greenie.feet}' ${greenie.inches}"`;
}
