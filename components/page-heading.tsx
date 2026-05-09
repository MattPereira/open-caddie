import type { ReactNode } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";

type PageHeadingProps = {
  children: ReactNode;
  icon: IconSvgElement;
};

export function PageHeading({ children, icon }: PageHeadingProps) {
  return (
    <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-normal">
      <HugeiconsIcon icon={icon} size={26} aria-hidden />
      <span>{children}</span>
    </h1>
  );
}
