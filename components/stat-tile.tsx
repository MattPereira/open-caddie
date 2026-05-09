import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const statTileVariants = cva(
  "flex flex-col gap-0.5 rounded-md border bg-muted",
  {
    variants: {
      size: {
        sm: "min-w-12 px-2 py-0.5",
        md: "min-w-16 px-3 py-1",
        lg: "min-w-20 px-4 py-1.5",
        responsive:
          "min-w-16 justify-center px-2 py-0.5 sm:min-w-16 sm:justify-start sm:px-3 sm:py-1 md:min-w-16 md:px-4 md:py-1.5",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

const statTileLabelVariants = cva(
  "flex items-center gap-1 font-medium text-muted-foreground",
  {
    variants: {
      size: {
        sm: "text-[10px]",
        md: "text-xs",
        lg: "text-xs",
        responsive: "text-xs",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

const statTileValueVariants = cva(
  "text-end tabular-nums text-card-foreground",
  {
    variants: {
      size: {
        sm: "text-xs",
        md: "text-sm",
        lg: "text-base font-semibold",
        responsive: "text-sm font-semibold",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

type StatTileProps = {
  label: string;
  value: string | number;
  className?: string;
} & VariantProps<typeof statTileVariants>;

export function StatTile({ label, value, size, className }: StatTileProps) {
  return (
    <div className={cn(statTileVariants({ size }), className)}>
      <div className={statTileLabelVariants({ size })}>
        <span>{label}</span>
      </div>
      <span className={statTileValueVariants({ size })}>{value}</span>
    </div>
  );
}
