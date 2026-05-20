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
}: {
  playerName: string;
  initials: string;
  image: string | null;
  secondary?: ReactNode;
  primaryLabel: string;
  primaryValue: ReactNode;
  primaryValueAdjusted?: boolean;
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
      endSlot={
        <div className="flex flex-col items-end leading-none">
          <span
            className={cn(
              "text-lg font-medium tabular-nums",
              primaryValueAdjusted && "text-red-600 dark:text-red-500",
            )}
          >
            {primaryValue}
          </span>
          <span className="mt-1 text-sm text-muted-foreground">
            {primaryLabel}
          </span>
        </div>
      }
    >
      {secondary ? (
        <CardDescription className="truncate text-sm leading-snug">
          {secondary}
        </CardDescription>
      ) : null}
    </MediaCard>
  );
}
