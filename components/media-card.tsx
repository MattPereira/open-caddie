import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { GolfHoleIcon } from "@hugeicons/core-free-icons";
import type { VariantProps } from "class-variance-authority";

import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MediaCardBadge = {
  label: ReactNode;
  variant?: VariantProps<typeof badgeVariants>["variant"];
};

type MediaCardVariant = "wide" | "square";

type MediaCardProps = {
  imageUrl: string | null;
  imageAlt: string;
  header?: ReactNode;
  children?: ReactNode;
  badges?: MediaCardBadge[];
  href?: string;
  onClick?: () => void;
  variant?: MediaCardVariant;
};

export function MediaCard({
  imageUrl,
  imageAlt,
  header,
  children,
  badges = [],
  href,
  onClick,
}: MediaCardProps) {
  const content = (
    <>
      <MediaCardImage src={imageUrl} alt={imageAlt} />
      <div className="flex min-w-0 flex-1 flex-col self-stretch justify-between p-1 lg:p-2">
        <CardHeader className="px-0!">
          {header ? (
            <CardTitle className="truncate text-sm sm:text-base">
              {header}
            </CardTitle>
          ) : null}
        </CardHeader>

        {children ? <div className="min-w-0">{children}</div> : null}

        {badges.length > 0 ? (
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
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
    </>
  );

  return (
    <Card className="py-1.5">
      <CardContent className="px-1.5">
        {href ? (
          <Link
            href={href}
            className="gap-4 rounded-lg flex w-full items-center text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {content}
          </Link>
        ) : onClick ? (
          <button
            type="button"
            onClick={onClick}
            className="gap-2 lg:gap-4 rounded-lg flex w-full items-center text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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

export function MediaCardImage({
  src,
  alt,
}: {
  src: string | null;
  alt: string;
}) {
  return (
    <div className={"w-1/3 shrink-0"}>
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
