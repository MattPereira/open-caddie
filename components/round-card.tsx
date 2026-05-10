import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { CardDescription } from "@/components/ui/card";
import { MediaCard } from "@/components/media-card";
import { formatDate } from "@/lib/utils";

export type RoundCardRound = {
  date: Date | string;
  courseName: string | null;
  courseImgUrl: string | null;
  tournamentId?: number | null;
  tournamentSeason?: number | null;
  clubName?: string | null;
};

export function RoundCard({
  round,
  href,
  onClick,
}: {
  round: RoundCardRound;
  href?: string;
  onClick?: () => void;
}) {
  const courseName = round.courseName ?? "Course to be announced";
  const badges = [];

  if (round.clubName) {
    badges.push({ label: round.clubName });
  }

  if (round.tournamentSeason != null) {
    badges.push({ label: `Season ${round.tournamentSeason}` });
  }

  return (
    <MediaCard
      imageUrl={round.courseImgUrl}
      imageAlt={courseName}
      header={courseName}
      badges={badges}
      href={href}
      onClick={onClick}
    >
      <CardDescription className="flex flex-col gap-2">
        <span className="flex items-center gap-1 text-xs leading-snug">
          <HugeiconsIcon icon={Calendar03Icon} size={12} aria-hidden />
          <span>{formatDate(round.date)}</span>
        </span>
      </CardDescription>
    </MediaCard>
  );
}
