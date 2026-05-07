import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function ResponsiveTable({
  desktop,
  mobile,
  className,
}: {
  desktop: ReactNode;
  mobile: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)}>
      <div className="hidden lg:block">{desktop}</div>
      <div className="lg:hidden">{mobile}</div>
    </div>
  );
}

export function TableFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-fit max-w-full overflow-hidden rounded-xl ring-1 ring-border",
        className,
      )}
    >
      {children}
    </div>
  );
}
