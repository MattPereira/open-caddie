import Image from "next/image";

import { AspectRatio } from "@/components/ui/aspect-ratio";
import { CardDescription } from "@/components/ui/card";
import { MediaCard } from "@/components/shared/media-card";

export type ClubCardClub = {
  handle: string;
  name: string;
  logo: string | null;
  membersCount?: number;
  tournamentsCount?: number;
};

export function ClubCard({
  club,
  href,
  onClick,
}: {
  club: ClubCardClub;
  href?: string;
  onClick?: () => void;
}) {
  const stats: string[] = [];
  if (club.membersCount != null) {
    stats.push(
      `${club.membersCount} ${club.membersCount === 1 ? "member" : "members"}`,
    );
  }
  if (club.tournamentsCount != null) {
    stats.push(
      `${club.tournamentsCount} ${club.tournamentsCount === 1 ? "tournament" : "tournaments"}`,
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
            {club.logo ? (
              <Image
                src={club.logo}
                alt={club.name}
                fill
                sizes="80px"
                className="object-cover"
              />
            ) : null}
          </AspectRatio>
        </div>
      }
      header={club.name}
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
