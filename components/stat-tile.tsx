import { cn } from "@/lib/utils";

type StatTileProps = {
  label: string;
  value: string | number;
  className?: string;
};

export function StatTile({ label, value, className }: StatTileProps) {
  return (
    <div
      className={cn(
        "flex min-w-16 flex-col gap-0.5 rounded-md border bg-muted px-3 py-1",
        className,
      )}
    >
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-end text-sm tabular-nums text-card-foreground">
        {value}
      </span>
    </div>
  );
}
