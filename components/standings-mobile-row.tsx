"use client";

import { useState } from "react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { displayName, getInitials } from "@/components/player-card";
import { StatTile } from "@/components/stat-tile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { PointKey, PointSummaryColumn } from "@/components/standings-table";

export type MobileStanding = {
  userId: string;
  user: {
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    image: string | null;
  };
  roundsPlayed: number;
  droppedRounds: number;
  points: Record<PointKey, number> & { total: number };
  countedRounds: Array<{
    roundId: number;
    dateLabel: string;
    courseName: string;
    points: Record<PointKey, number> & { total: number };
  }>;
};

export function StandingsMobileRow({
  standing,
  pointColumns,
}: {
  standing: MobileStanding;
  pointColumns: PointSummaryColumn[];
}) {
  const [openRoundId, setOpenRoundId] = useState<number | null>(null);
  const name = displayName(standing.user);

  return (
    <Collapsible className="border-b last:border-b-0">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="group flex w-full min-w-0 items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50 data-[state=open]:bg-muted/50"
        >
          <Avatar className="size-16">
            {standing.user.image ? (
              <AvatarImage src={standing.user.image} alt={name} />
            ) : null}
            <AvatarFallback>{getInitials(standing.user)}</AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium">{name}</span>
            <span className="text-xs text-muted-foreground">
              {standing.roundsPlayed} rounds
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {standing.droppedRounds > 0 ? (
              <Badge variant="outline">{standing.droppedRounds} dropped</Badge>
            ) : null}
            <span className="min-w-12 text-right text-xl font-semibold tabular-nums">
              {standing.points.total}
            </span>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              size={16}
              aria-hidden
              className="text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
            />
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-3 border-t px-3 py-3">
          <div className="grid grid-cols-4 gap-2">
            {pointColumns.map((column) => (
              <StatTile
                key={`${standing.userId}-mobile-${column.key}`}
                label={column.label}
                value={standing.points[column.key]}
              />
            ))}
          </div>
          <div className="flex flex-col overflow-hidden rounded-lg border">
            {standing.countedRounds.map((round) => (
              <Collapsible
                key={`${standing.userId}-round-${round.roundId}`}
                open={openRoundId === round.roundId}
                onOpenChange={(open) =>
                  setOpenRoundId(open ? round.roundId : null)
                }
                className="border-b last:border-b-0"
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="group/round flex w-full min-w-0 items-center gap-2 px-2.5 py-2 text-left text-sm hover:bg-muted/50 data-[state=open]:bg-muted/50"
                  >
                    <span className="w-12 shrink-0 text-xs text-muted-foreground">
                      {round.dateLabel}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {round.courseName}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {round.points.total}
                    </span>
                    <HugeiconsIcon
                      icon={ArrowDown01Icon}
                      size={14}
                      aria-hidden
                      className="shrink-0 text-muted-foreground transition-transform group-data-[state=open]/round:rotate-180"
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid grid-cols-4 gap-2 border-t bg-muted/25 p-2">
                    {pointColumns.map((column) => (
                      <StatTile
                        key={`${standing.userId}-round-${round.roundId}-${column.key}`}
                        label={column.label}
                        value={round.points[column.key]}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
