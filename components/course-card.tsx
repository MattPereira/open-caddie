import { MediaCard } from "@/components/media-card";
import { StatTile } from "@/components/stat-tile";

export type CourseCardCourse = {
  name: string;
  rating: string;
  slope: number;
  imgUrl: string | null;
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
  return (
    <MediaCard
      imageUrl={course.imgUrl}
      imageAlt={course.name}
      header={course.name}
      href={href}
      onClick={onClick}
    >
      <div className="flex shrink-0 items-center justify-end gap-1.5">
        <StatTile label="Rating" value={course.rating} />
        <StatTile label="Slope" value={course.slope} />
      </div>
    </MediaCard>
  );
}
