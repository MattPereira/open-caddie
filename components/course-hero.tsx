import Image from "next/image";
import { GolfHoleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export function CourseHero({
  courseName,
  courseImgUrl,
  subtitle: _subtitle,
}: {
  courseName: string | null;
  courseImgUrl: string | null;
  subtitle?: string;
}) {
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
    </div>
  );
}
