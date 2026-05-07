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
      badges={[
        { label: `Rating ${course.rating}` },
        { label: `Slope ${course.slope}` },
      ]}
      href={href}
      onClick={onClick}
    />
  );
}
