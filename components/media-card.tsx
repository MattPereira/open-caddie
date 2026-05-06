import type { ReactNode } from "react";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import { GolfHoleIcon } from "@hugeicons/core-free-icons";
import type { VariantProps } from "class-variance-authority";

import { Badge, badgeVariants } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MediaCardBadge = {
  label: ReactNode;
  variant?: VariantProps<typeof badgeVariants>["variant"];
};

type MediaCardProps = {
  imageUrl: string | null;
  imageAlt: string;
  header: ReactNode;
  children?: ReactNode;
  badges?: MediaCardBadge[];
  onClick?: () => void;
};

export function MediaCard({
  imageUrl,
  imageAlt,
  header,
  children,
  badges = [],
  onClick,
}: MediaCardProps) {
  const content = (
    <>
      <MediaCardImage src={imageUrl} alt={imageAlt} />
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 p-3">
        <CardHeader className="gap-2 px-0">
          <CardTitle className="truncate text-base">{header}</CardTitle>
          {children}
        </CardHeader>

        {badges.length > 0 ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {badges.map((badge, index) => (
              <Badge
                key={index}
                variant={badge.variant ?? "outline"}
                className="max-w-full truncate"
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
    <Card size="sm" className="gap-0 py-0!">
      <CardContent className="p-0!">
        {onClick ? (
          <button
            type="button"
            onClick={onClick}
            className="flex w-full items-stretch text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {content}
          </button>
        ) : (
          <div className="flex items-stretch">{content}</div>
        )}
      </CardContent>
    </Card>
  );
}

function MediaCardImage({ src, alt }: { src: string | null; alt: string }) {
  return (
    <div className="relative h-28 w-32 shrink-0 self-stretch overflow-hidden rounded-xl bg-muted sm:h-30 sm:w-44">
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(min-width: 640px) 176px, 128px"
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
