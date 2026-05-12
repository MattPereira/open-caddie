import Image from "next/image";
import type { ReactNode } from "react";
import { GolfHoleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export function CourseHero({
  courseName,
  courseImgUrl,
  subtitle,
  action,
}: {
  courseName: string | null;
  courseImgUrl: string | null;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="relative aspect-[21/9] w-full overflow-hidden rounded-xl bg-zinc-900 sm:aspect-[3/1] lg:aspect-[4/1] xl:aspect-[5/1]">
      {courseImgUrl ? (
        <Image
          src={courseImgUrl}
          alt={courseName ?? "Course"}
          fill
          sizes="100vw"
          priority
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-white/50">
          <HugeiconsIcon icon={GolfHoleIcon} size={48} aria-hidden />
        </div>
      )}

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/45"
      />

      <div className="absolute inset-x-0 top-0 flex flex-col gap-0.5 p-3 sm:p-4 lg:p-5">
        <h1 className="text-2xl font-semibold tracking-normal text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] sm:text-3xl">
          {courseName ?? "Course to be announced"}
        </h1>
        {subtitle ? (
          <p className="text-sm font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            {subtitle}
          </p>
        ) : null}
      </div>

      {action ? (
        <div className="absolute right-0 bottom-0 p-3 sm:p-4 lg:p-5">
          {action}
        </div>
      ) : null}
    </div>
  );
}
