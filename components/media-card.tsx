import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
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
  header?: ReactNode;
  children?: ReactNode;
  badges?: MediaCardBadge[];
  href?: string;
  onClick?: () => void;
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
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5 px-3 py-1.5">
        <CardHeader className="px-0!">
          {header ? <CardTitle className="truncate">{header}</CardTitle> : null}
        </CardHeader>

        {children ? <div className="min-w-0">{children}</div> : null}

        {badges.length > 0 ? (
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
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
    <Card size="sm" className="py-0!">
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

function MediaCardImage({ src, alt }: { src: string | null; alt: string }) {
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
