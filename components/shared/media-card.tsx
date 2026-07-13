import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { GolfHoleIcon } from "@hugeicons/core-free-icons";
import type { VariantProps } from "class-variance-authority";

import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Card, CardContent, CardTitle } from "@/components/ui/card";

type MediaCardBadge = {
  label: ReactNode;
  variant?: VariantProps<typeof badgeVariants>["variant"];
};

type MediaCardProps = {
  imageUrl?: string | null;
  imageAlt?: string;
  media?: ReactNode;
  header?: ReactNode;
  children?: ReactNode;
  badges?: MediaCardBadge[];
  endSlot?: ReactNode;
  href?: string;
  onClick?: () => void;
};

export function MediaCard({
  imageUrl,
  imageAlt = "",
  media,
  header,
  children,
  badges = [],
  endSlot,
  href,
  onClick,
}: MediaCardProps) {
  const hasCustomMedia = media !== undefined;

  const mediaSlot = hasCustomMedia ? (
    media
  ) : (
    <MediaCardImage src={imageUrl ?? null} alt={imageAlt} />
  );

  const content = (
    <>
      {mediaSlot}
      <div className="flex min-w-0 flex-1 flex-col">
        {header ? (
          <CardTitle className="truncate text-base">
            {header}
          </CardTitle>
        ) : null}

        {children ? <div className="min-w-0">{children}</div> : null}

        {badges.length > 0 ? (
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            {badges.map((badge, index) => (
              <Badge
                key={index}
                variant={badge.variant ?? "outline"}
                className="max-w-full truncate font-light lg:text-sm lg:p-3"
              >
                {badge.label}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
      {endSlot ? (
        <div className="shrink-0 pr-3">{endSlot}</div>
      ) : (
        <div className="pr-2" />
      )}
    </>
  );

  const interactiveClasses =
    "flex w-full items-center gap-3 rounded-lg text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <Card className="py-0">
      <CardContent className="px-0">
        {href ? (
          <Link href={href} className={interactiveClasses}>
            {content}
          </Link>
        ) : onClick ? (
          <button
            type="button"
            onClick={onClick}
            className={interactiveClasses}
          >
            {content}
          </button>
        ) : (
          <div className="flex items-center gap-3">{content}</div>
        )}
      </CardContent>
    </Card>
  );
}

export function MediaCardImage({
  src,
  alt,
}: {
  src: string | null;
  alt: string;
}) {
  return (
    <div className={"w-2/5 shrink-0"}>
      <AspectRatio
        ratio={16 / 9}
        className="overflow-hidden rounded-xl bg-muted"
      >
        {src ? (
          <Image
            src={src}
            alt={alt}
            fill
            sizes="(min-width: 640px) 33vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <HugeiconsIcon icon={GolfHoleIcon} size={32} aria-hidden />
          </div>
        )}
      </AspectRatio>
    </div>
  );
}
