import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon } from "@hugeicons/core-free-icons";

import { CardDescription } from "@/components/ui/card";
import { MediaCard } from "@/components/media-card";
import { formatDate } from "@/lib/utils";

export type TournamentCardTournament = {
  clubName: string;
  date: Date | string;
  startsAt?: string | null;
  season?: number | null;
  courseName: string | null;
  courseImgUrl: string | null;
};

export function TournamentCard({
  tournament,
  href,
  onClick,
}: {
  tournament: TournamentCardTournament;
  href?: string;
  onClick?: () => void;
}) {
  const courseName = tournament.courseName ?? "Course to be announced";
  const badges = [{ label: tournament.clubName }];

  if (tournament.season != null) {
    badges.push({ label: `Season ${tournament.season}` });
  }

  return (
    <MediaCard
      imageUrl={tournament.courseImgUrl}
      imageAlt={courseName}
      header={courseName}
      badges={badges}
      href={href}
      onClick={onClick}
    >
      <CardDescription className="flex items-center gap-1 text-xs leading-snug">
        <HugeiconsIcon icon={Calendar03Icon} size={12} aria-hidden />
        <span>{formatDate(tournament.date)}</span>
      </CardDescription>
    </MediaCard>
  );
}
