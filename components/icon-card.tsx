import type { ReactNode } from "react";
import Link from "next/link";
import type { VariantProps } from "class-variance-authority";

import { Badge, badgeVariants } from "@/components/ui/badge";
import { Card, CardContent, CardTitle } from "@/components/ui/card";

type IconCardBadge = {
  label: ReactNode;
  variant?: VariantProps<typeof badgeVariants>["variant"];
};

type IconCardProps = {
  leading?: ReactNode;
  header?: ReactNode;
  children?: ReactNode;
  badges?: IconCardBadge[];
  href?: string;
  onClick?: () => void;
};

export function IconCard({
  leading,
  header,
  children,
  badges = [],
  href,
  onClick,
}: IconCardProps) {
  const content = (
    <>
      {leading ? (
        <div className="flex size-15 shrink-0 items-center justify-center self-start rounded-lg bg-muted text-muted-foreground">
          {leading}
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {header ? (
            <CardTitle className="min-w-0 flex-1 truncate">{header}</CardTitle>
          ) : null}
          {badges.length > 0 ? (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
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
        {children}
      </div>
    </>
  );

  return (
    <Card size="sm" className="gap-0 py-0!">
      <CardContent className="p-0!">
        {href ? (
          <Link
            href={href}
            className="flex w-full items-stretch gap-3 p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {content}
          </Link>
        ) : onClick ? (
          <button
            type="button"
            onClick={onClick}
            className="flex w-full items-stretch gap-3 p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {content}
          </button>
        ) : (
          <div className="flex items-stretch gap-3 p-3">{content}</div>
        )}
      </CardContent>
    </Card>
  );
}
