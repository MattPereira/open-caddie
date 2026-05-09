import { MediaCard } from "@/components/media-card";

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
        <CourseStat label="Rating" value={course.rating} />
        <CourseStat label="Slope" value={course.slope} />
      </div>
    </MediaCard>
  );
}

function CourseStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex min-w-20 flex-col gap-0.5 rounded-md bg-muted px-3 py-1">
      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <span>{label}</span>
      </div>
      <span className="text-end text-sm font-semibold tabular-nums text-card-foreground">
        {value}
      </span>
    </div>
  );
}
