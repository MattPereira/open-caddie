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
  totalStrokes: number | null;
  totalPutts: number | null;
};

export function RoundCard({
  round,
  href,
}: {
  round: RoundCardRound;
  href?: string;
}) {
  const courseName = round.courseName ?? "Course to be announced";
  const stats = [
    round.totalStrokes != null ? `${round.totalStrokes} strokes` : null,
    formatDate(round.date, "short"),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <MediaCard
      imageUrl={round.courseImgUrl}
      imageAlt={courseName}
      header={courseName}
      href={href}
    >
      <CardDescription className="truncate text-sm leading-snug">
        {stats}
      </CardDescription>
    </MediaCard>
  );
}
