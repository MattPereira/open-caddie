import { cn } from "@/lib/utils";

type StatTileProps = {
  label?: string;
  value: string | number | null | undefined;
  className?: string;
};

export function StatTile({ label, value, className }: StatTileProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 w-full justify-between flex-row items-end gap-2 rounded-lg border bg-muted py-1 px-2",
        className,
      )}
    >
      {label != null && (
        <span className="text-xs text-muted-foreground">{label}</span>
      )}
      <span className="text-end text-sm">{value ?? "-"}</span>
    </div>
  );
}
