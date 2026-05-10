import type { ReactNode } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";

type PageHeadingProps = {
  children: ReactNode;
  icon: IconSvgElement;
  description?: string;
};

export function PageHeading({ children, icon, description }: PageHeadingProps) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-normal">
        <HugeiconsIcon icon={icon} size={26} aria-hidden />
        <span>{children}</span>
      </h1>
      {description ? (
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
