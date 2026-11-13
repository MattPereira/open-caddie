import { cn } from "@/lib/utils";

export function CardGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-3 xl:grid-cols-2", className)}>
      {children}
    </div>
  );
}
