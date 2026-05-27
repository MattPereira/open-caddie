import Image from "next/image";
import { GolfHoleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { formatDate } from "@/lib/utils";

export function CourseHero({
  courseName,
  courseImgUrl,
  date,
  showLabel = false,
}: {
  courseName: string | null;
  courseImgUrl: string | null;
  date?: Date | string | null;
  showLabel?: boolean;
}) {
  const showText = showLabel || date != null;
  const formattedDate = date ? formatDate(date, "shorter") : null;

  return (
    <div className="relative aspect-21/9 w-full overflow-hidden rounded-xl bg-zinc-900 sm:aspect-3/1">
      {courseImgUrl ? (
        <Image
          src={courseImgUrl}
          alt={courseName ?? "Course"}
          fill
          sizes="100vw"
          priority
          className="object-cover object-bottom"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-white/50">
          <HugeiconsIcon icon={GolfHoleIcon} size={48} aria-hidden />
        </div>
      )}

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-linear-to-b from-black/50 via-black/15 to-black/30"
      />

      {showText ? (
        <>
          {courseName ? (
            <p className="absolute bottom-0 left-0 p-4 text-xl font-medium text-white text-shadow-lg sm:p-5 sm:text-4xl">
              {courseName}
            </p>
          ) : null}
          {formattedDate ? (
            <p className="absolute top-0 right-0 p-4 text-sm font-medium text-white text-shadow-lg sm:p-5 sm:text-base">
              {formattedDate}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
