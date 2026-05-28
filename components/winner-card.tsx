import type { ReactNode } from "react";

import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CardDescription } from "@/components/ui/card";
import { MediaCard } from "@/components/media-card";
import { cn } from "@/lib/utils";

export function WinnerCard({
  playerName,
  initials,
  image,
  secondary,
  primaryLabel,
  primaryValue,
  primaryValueAdjusted,
  primaryValueTone,
  href,
}: {
  playerName: string;
  initials: string;
  image: string | null;
  secondary?: ReactNode;
  primaryLabel?: string;
  primaryValue: ReactNode;
  primaryValueAdjusted?: boolean;
  primaryValueTone?: "winning" | "losing" | "neutral";
  href?: string;
}) {
  return (
    <MediaCard
      media={
        <div className="w-1/5 shrink-0">
          <AspectRatio
            ratio={1}
            className="overflow-hidden rounded-xl bg-muted"
          >
            <Avatar className="size-full rounded-none">
              {image ? <AvatarImage src={image} alt={playerName} /> : null}
              <AvatarFallback className="rounded-none text-lg">
                {initials}
              </AvatarFallback>
            </Avatar>
          </AspectRatio>
        </div>
      }
      header={playerName}
      href={href}
      endSlot={
        <div className="flex flex-col items-end leading-none gap-1">
          <span
            className={cn(
              "text-lg tabular-nums",
              primaryValueAdjusted && "text-red-600 dark:text-red-500",
              primaryValueTone === "winning" &&
                "font-medium text-emerald-600 dark:text-emerald-500",
              primaryValueTone === "losing" &&
                "font-medium text-red-600 dark:text-red-500",
            )}
          >
            {primaryValue}
          </span>
          {primaryLabel ? (
            <span className="text-sm text-muted-foreground">
              {primaryLabel}
            </span>
          ) : null}
        </div>
      }
    >
      {secondary ? (
        <CardDescription className="flex min-w-0 flex-col text-sm leading-snug">
          {secondary}
        </CardDescription>
      ) : null}
    </MediaCard>
  );
}
