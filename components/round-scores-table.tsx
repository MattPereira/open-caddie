"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  formatDecimalScore,
  formatScore,
  HoleScore,
  PlayerLabel,
  RoundScoresCard,
  ScoreMetricSwitch,
  type RoundScoreRow,
  type RoundScoresTableRound,
  type ScoreMetric,
} from "@/components/round-scores-card";
import { toRoundScoreRow } from "@/components/round-scores-card-row";
import { ResponsiveTable, TableFrame } from "@/components/responsive-table";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  RoundScoresSheet,
  type EditableRound,
} from "@/app/(app)/rounds/[id]/_components/round-scores-sheet";

export type { RoundScoresTableRound } from "@/components/round-scores-card";

const holes = Array.from({ length: 18 }, (_, index) => index + 1);

type RoundScoresTableProps = {
  currentUser?: {
    id: string;
    isAdmin: boolean;
  } | null;
  rounds: RoundScoresTableRound[];
  showMobileTotals?: boolean;
};

export function RoundScoresTable({
  currentUser,
  rounds,
  showMobileTotals = true,
}: RoundScoresTableProps) {
  const rows = rounds.map(toRoundScoreRow);

  return (
    <ResponsiveTable
      desktop={<DesktopRoundScoresTable rows={rows} />}
      mobile={
        <MobileRoundScoresCards
          currentUser={currentUser}
          rows={rows}
          showMobileTotals={showMobileTotals}
        />
      }
    />
  );
}

function DesktopRoundScoresTable({ rows }: { rows: RoundScoreRow[] }) {
  const [metric, setMetric] = useState<ScoreMetric>("strokes");
  const sortedRows =
    metric === "strokes" ? rows : [...rows].sort(compareRoundScoreRowsByPutts);
  const greenieHoles = new Set(
    rows.flatMap(
      (row) => row.round.greenies?.map((greenie) => greenie.hole) ?? [],
    ),
  );

  return (
    <div className="relative w-fit max-w-full">
      <div className="absolute -top-8 right-0 z-20">
        <ScoreMetricSwitch
          id="desktop-round-score-metric"
          metric={metric}
          onMetricChange={setMetric}
        />
      </div>
      <TableFrame>
        <Table className="w-max">
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 min-w-32 bg-card">
                Player
              </TableHead>
              {holes.map((hole) => (
                <TableHead
                  key={hole}
                  className={cn(
                    "w-10 text-center",
                    greenieHoles.has(hole) &&
                      "text-green-600 dark:text-green-400",
                  )}
                >
                  {hole}
                </TableHead>
              ))}
              <TableHead className="w-10 text-center">Out</TableHead>
              <TableHead className="w-10 text-center">In</TableHead>
              <TableHead className="w-12 text-center">Tot</TableHead>
              <TableHead className="w-12 text-center">Hcp</TableHead>
              <TableHead className="w-12 text-center">Net</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((row) => {
              const values = row.metrics[metric];

              return (
                <TableRow key={row.round.id}>
                  <TableCell className="sticky left-0 z-10 bg-card font-medium">
                    <PlayerLabel row={row} />
                  </TableCell>
                  {values.scores.map((score, index) => (
                    <TableCell
                      key={`${row.round.id}-${index}`}
                      className="text-center tabular-nums"
                    >
                      <HoleScore
                        score={score}
                        par={row.pars[index] ?? null}
                        showSymbol={metric === "strokes"}
                      />
                    </TableCell>
                  ))}
                  <ScoreTotalCell value={values.out} />
                  <ScoreTotalCell value={values.in} />
                  <ScoreTotalCell value={values.total} strong />
                  <DerivedScoreCell value={row.round.playingHandicap} />
                  <DerivedScoreCell value={row.round.netStrokes} strong />
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableFrame>
    </div>
  );
}

function MobileRoundScoresCards({
  currentUser,
  rows,
  showMobileTotals,
}: {
  currentUser?: RoundScoresTableProps["currentUser"];
  rows: RoundScoreRow[];
  showMobileTotals: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {rows.map((row) => {
        const editableRound = toEditableRound(row.round);
        const canEdit =
          currentUser != null &&
          editableRound != null &&
          (currentUser.isAdmin || currentUser.id === editableRound.userId);

        return (
          <RoundScoresCard
            key={row.round.id}
            action={
              canEdit ? (
                <RoundScoresCardEditAction round={editableRound} />
              ) : null
            }
            row={row}
            showMobileTotals={showMobileTotals}
          />
        );
      })}
    </div>
  );
}

function RoundScoresCardEditAction({ round }: { round: EditableRound }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setSheetOpen(true)}
              aria-label="Edit round"
            >
              <HugeiconsIcon icon={Edit03Icon} aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit round</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {sheetOpen ? (
        <RoundScoresSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onDeleted={() => router.refresh()}
          round={round}
        />
      ) : null}
    </>
  );
}

function ScoreTotalCell({
  value,
  strong,
}: {
  value: number | null;
  strong?: boolean;
}) {
  return (
    <TableCell
      className={cn(
        "text-center tabular-nums",
        strong ? "font-semibold" : "font-medium",
      )}
    >
      {formatScore(value)}
    </TableCell>
  );
}

function DerivedScoreCell({
  value,
  strong,
}: {
  value: number | null;
  strong?: boolean;
}) {
  return (
    <TableCell
      className={cn(
        "text-center tabular-nums",
        strong ? "font-semibold" : "font-medium",
      )}
    >
      {formatDecimalScore(value)}
    </TableCell>
  );
}

function toEditableRound(round: RoundScoresTableRound): EditableRound | null {
  if (
    !round.userId ||
    !round.teeId ||
    !round.holes ||
    !round.tees ||
    !round.greenies ||
    !round.courseSlope
  ) {
    return null;
  }

  return {
    id: round.id,
    matchId: round.matchId ?? null,
    teeId: round.teeId,
    userId: round.userId,
    firstName: round.firstName,
    courseSlope: round.courseSlope,
    handicapIndexOverride: round.handicapIndexOverride ?? null,
    holes: round.holes,
    tees: round.tees,
    scores: round.scores,
    greenies: round.greenies,
  };
}

function compareRoundScoreRowsByPutts(a: RoundScoreRow, b: RoundScoreRow) {
  const totalA = a.metrics.putts.total;
  const totalB = b.metrics.putts.total;

  if (totalA == null && totalB == null) {
    return a.playerName.localeCompare(b.playerName);
  }

  if (totalA == null) return 1;
  if (totalB == null) return -1;

  const totalCompare = totalA - totalB;
  if (totalCompare !== 0) return totalCompare;

  return a.playerName.localeCompare(b.playerName);
}
