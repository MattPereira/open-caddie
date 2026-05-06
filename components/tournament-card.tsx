import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon } from "@hugeicons/core-free-icons";

import { CardDescription } from "@/components/ui/card";
import { MediaCard } from "@/components/media-card";

export type TournamentCardTournament = {
  clubName: string;
  date: Date | string;
  startsAt?: string | null;
  season?: number | null;
  courseName: string | null;
  courseImgUrl: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function TournamentCard({
  tournament,
  onClick,
}: {
  tournament: TournamentCardTournament;
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
      onClick={onClick}
    >
      <CardDescription className="flex items-center gap-1.5">
        <HugeiconsIcon icon={Calendar03Icon} size={15} aria-hidden />
        <span>
          {formatTournamentDate(tournament.date)}
          {tournament.startsAt ? `, ${formatTournamentTime(tournament.startsAt)}` : ""}
        </span>
      </CardDescription>
    </MediaCard>
  );
}

function formatTournamentDate(date: Date | string) {
  if (typeof date === "string") {
    return dateFormatter.format(new Date(`${date}T00:00:00.000Z`));
  }

  return dateFormatter.format(date);
}

function formatTournamentTime(time: string) {
  const [hours = "0", minutes = "0"] = time.split(":");
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2000, 0, 1, Number(hours), Number(minutes)));
}
