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
  playerCount?: number;
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
  const stats: string[] = [formatDate(tournament.date, "short")];
  if (tournament.playerCount != null) {
    stats.push(
      `${tournament.playerCount} ${tournament.playerCount === 1 ? "player" : "players"}`,
    );
  }

  return (
    <MediaCard
      imageUrl={tournament.courseImgUrl}
      imageAlt={courseName}
      header={courseName}
      href={href}
      onClick={onClick}
    >
      <CardDescription className="text-sm leading-snug">
        {stats.join(" · ")}
      </CardDescription>
    </MediaCard>
  );
}
