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
    <div className={cn("min-w-0 w-full", className)}>
      <div className="hidden min-w-0 lg:block">{desktop}</div>
      <div className="min-w-0 lg:hidden">{mobile}</div>
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
