import Image from "next/image";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { GolfHoleIcon } from "@hugeicons/core-free-icons";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  const content = (
    <>
      <CourseCardImage src={course.imgUrl} alt={course.name} />
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1 px-3 py-2">
        <CardHeader className="gap-1 px-0!">
          <CardTitle className="truncate">{course.name}</CardTitle>
        </CardHeader>

        <div className="flex shrink-0 items-center justify-end gap-1.5">
          <CourseStat label="Rating" value={course.rating} />
          <CourseStat label="Slope" value={course.slope} />
        </div>
      </div>
    </>
  );

  return (
    <Card size="sm" className="gap-0 py-0!">
      <CardContent className="p-0!">
        {href ? (
          <Link
            href={href}
            className="flex w-full items-center text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {content}
          </Link>
        ) : onClick ? (
          <button
            type="button"
            onClick={onClick}
            className="flex w-full items-center text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {content}
          </button>
        ) : (
          <div className="flex items-center">{content}</div>
        )}
      </CardContent>
    </Card>
  );
}

function CourseCardImage({ src, alt }: { src: string | null; alt: string }) {
  return (
    <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-22 sm:w-40">
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(min-width: 640px) 160px, 112px"
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <HugeiconsIcon icon={GolfHoleIcon} size={32} aria-hidden />
        </div>
      )}
    </div>
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
