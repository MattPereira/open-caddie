import { cn } from "@/lib/utils";

type StatTileProps = {
  label: string;
  value: string | number | null | undefined;
  className?: string;
};

export function StatTile({ label, value, className }: StatTileProps) {
  return (
    <div
      className={cn(
        "flex flex-col w-full justify-between rounded-lg border bg-muted px-2 py-1",
        className,
      )}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-end text-sm">{value ?? "-"}</span>
    </div>
  );
}
