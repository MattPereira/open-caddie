import { CardDescription } from "@/components/ui/card";
import { MediaCard } from "@/components/media-card";
import { formatDate } from "@/lib/utils";

export type EventCardEvent = {
  date: Date | string;
  startsAt?: string | null;
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
  const stats: string[] = [formatDate(event.date, "short")];

  if (event.playerCount != null) {
    stats.push(
      `${event.playerCount} ${event.playerCount === 1 ? "player" : "players"}`,
    );
  }

  return (
    <MediaCard
      imageUrl={event.courseImgUrl}
      imageAlt={courseName}
      header={title}
      href={href}
      onClick={onClick}
    >
      <CardDescription className="text-sm leading-snug">
        {stats.join(" · ")}
      </CardDescription>
    </MediaCard>
  );
}
