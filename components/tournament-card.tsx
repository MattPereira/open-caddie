import { EventCard } from "@/components/event-card";

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
  return (
    <EventCard
      event={{
        date: tournament.date,
        startsAt: tournament.startsAt,
        courseName: tournament.courseName,
        courseImgUrl: tournament.courseImgUrl,
        playerCount: tournament.playerCount,
      }}
      href={href}
      onClick={onClick}
    />
  );
}
