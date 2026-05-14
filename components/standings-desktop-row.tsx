"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import type { PointKey, PointSummaryColumn } from "@/components/standings-table";
import { cn } from "@/lib/utils";

export type DesktopStanding = {
  userId: string;
  playerName: string;
  position: number;
  points: Record<PointKey, number> & { total: number };
  countedRounds: Array<{
    roundId: number;
    dateLabel: string;
    courseName: string;
    points: Record<PointKey, number> & { total: number };
  }>;
};

export function StandingsDesktopRowGroup({
  standing,
  pointColumns,
}: {
  standing: DesktopStanding;
  pointColumns: PointSummaryColumn[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible asChild open={open} onOpenChange={setOpen}>
      <TableBody>
        <TableRow>
          <TableCell className="text-center font-semibold tabular-nums">
            {standing.position}
          </TableCell>
          <TableCell className="sticky left-0 z-10 bg-card font-medium">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="group flex w-full min-w-0 items-center gap-2 rounded-md text-left hover:underline"
              >
                <span className="min-w-0 flex-1 truncate">
                  {standing.playerName}
                </span>
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  size={14}
                  aria-hidden
                  className="shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
                />
              </button>
            </CollapsibleTrigger>
          </TableCell>
          {pointColumns.map((column) => (
            <PointsCell
              key={`${standing.userId}-${column.key}`}
              value={standing.points[column.key]}
            />
          ))}
          <PointsCell value={standing.points.total} strong />
        </TableRow>

        {standing.countedRounds.map((round) => (
          <CollapsibleContent
            key={`${standing.userId}-round-${round.roundId}`}
            asChild
          >
            <TableRow className="bg-muted/25 hover:bg-muted/40">
              <TableCell />
              <TableCell className="sticky left-0 z-10 bg-muted/25">
                <Link
                  href={`/rounds/${round.roundId}`}
                  className="flex min-w-0 items-center gap-3 hover:underline"
                >
                  <span className="w-12 shrink-0 text-xs text-muted-foreground">
                    {round.dateLabel}
                  </span>
                  <span className="min-w-0 truncate text-sm">
                    {round.courseName}
                  </span>
                </Link>
              </TableCell>
              {pointColumns.map((column) => (
                <PointsCell
                  key={`${standing.userId}-round-${round.roundId}-${column.key}`}
                  value={round.points[column.key]}
                  muted
                />
              ))}
              <PointsCell value={round.points.total} strong muted />
            </TableRow>
          </CollapsibleContent>
        ))}
      </TableBody>
    </Collapsible>
  );
}

function PointsCell({
  value,
  strong,
  muted,
}: {
  value: number;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <TableCell
      className={cn(
        "text-center tabular-nums",
        strong ? "font-semibold" : "font-medium",
        muted && "text-sm",
      )}
    >
      {value}
    </TableCell>
  );
}
