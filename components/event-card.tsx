import { MediaCard } from "@/components/media-card";
import { formatDate } from "@/lib/utils";

export type EventCardEvent = {
  date: Date | string;
  title?: string | null;
  courseName: string | null;
  courseImgUrl: string | null;
  playerCount?: number;
};

export function EventCard({
  event,
  href,
  onClick,
}: {
  event: EventCardEvent;
  href?: string;
  onClick?: () => void;
}) {
  const courseName = event.courseName ?? "Course to be announced";
  const title = event.title?.trim() || courseName;
  const dateStats = [formatDate(event.date, "shorter")];

  return (
    <MediaCard
      imageUrl={event.courseImgUrl}
      imageAlt={courseName}
      header={title}
      href={href}
      onClick={onClick}
    >
      <div className="flex flex-col text-sm leading-snug text-muted-foreground">
        <span className="truncate">{courseName}</span>
        <span>{dateStats.join(" · ")}</span>
      </div>
    </MediaCard>
  );
}
