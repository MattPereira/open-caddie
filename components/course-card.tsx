import { CardDescription } from "@/components/ui/card";
import { MediaCard } from "@/components/media-card";

export type CourseCardCourse = {
  name: string;
  rating: string;
  slope: number;
  imgUrl: string | null;
  roundCount?: number;
  greenieCount?: number;
};

export function CourseCard({
  course,
  href,
  onClick,
}: {
  course: CourseCardCourse;
  href?: string;
  onClick?: () => void;
}) {
  const stats: string[] = [];
  if (course.roundCount != null) {
    stats.push(`${course.roundCount} ${course.roundCount === 1 ? "round" : "rounds"}`);
  }
  if (course.greenieCount != null) {
    stats.push(`${course.greenieCount} ${course.greenieCount === 1 ? "greenie" : "greenies"}`);
  }

  return (
    <MediaCard
      imageUrl={course.imgUrl}
      imageAlt={course.name}
      header={course.name}
      href={href}
      onClick={onClick}
    >
      {stats.length > 0 ? (
        <CardDescription className="text-sm leading-snug">
          {stats.join(" · ")}
        </CardDescription>
      ) : null}
    </MediaCard>
  );
}
