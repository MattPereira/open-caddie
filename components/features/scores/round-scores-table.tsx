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
} from "@/components/features/scores/round-scores-card";
import { toRoundScoreRow } from "@/components/features/scores/round-scores";
import { ResponsiveTable, TableFrame } from "@/components/shared/responsive-table";
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
  type EditableCourse,
  type EditableRound,
} from "@/app/(app)/rounds/[id]/_components/round-scores-sheet";

export type { RoundScoresTableRound } from "@/components/features/scores/round-scores-card";

const holes = Array.from({ length: 18 }, (_, index) => index + 1);

export type RoundsEditAccess = {
  /** Rounds the viewer is a Scorer of, so may edit from the table. */
  scorableRoundIds: readonly number[];
  /** Rounds whose tee and override the viewer may also change. */
  manageableRoundIds: readonly number[];
};

/** A table row's Round, editable from the table by its Scorers. */
export type EditableTableRound = RoundScoresTableRound & EditableRound;

type RoundScoresTableProps = {
  editAccess?: RoundsEditAccess | null;
  rounds: EditableTableRound[];
  course: EditableCourse;
  showMobileTotals?: boolean;
};

export function RoundScoresTable({
  editAccess,
  rounds,
  course,
  showMobileTotals = true,
}: RoundScoresTableProps) {
  const rows = rounds.map((round) => ({ ...toRoundScoreRow(round), round }));

  return (
    <ResponsiveTable
      desktop={<DesktopRoundScoresTable rows={rows} />}
      mobile={
        <MobileRoundScoresCards
          editAccess={editAccess}
          course={course}
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
      (row) => row.round.greenies.map((greenie) => greenie.hole),
    ),
  );

  return (
    <div className="relative w-full">
      <div className="absolute -top-8 right-0 z-20">
        <ScoreMetricSwitch
          id="desktop-round-score-metric"
          metric={metric}
          onMetricChange={setMetric}
        />
      </div>
      <TableFrame className="w-full">
        <Table className="table-fixed">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="sticky left-0 z-10 w-36 bg-muted/60">
                Player
              </TableHead>
              {holes.slice(0, 9).map((hole) => (
                <TableHead
                  key={hole}
                  className={cn(
                    "w-8 px-1 text-center",
                    greenieHoles.has(hole) &&
                      "text-green-600 dark:text-green-400",
                  )}
                >
                  {hole}
                </TableHead>
              ))}
              <TableHead className="w-9 border-x bg-muted/60 px-1 text-center">
                Out
              </TableHead>
              {holes.slice(9).map((hole) => (
                <TableHead
                  key={hole}
                  className={cn(
                    "w-8 px-1 text-center",
                    greenieHoles.has(hole) &&
                      "text-green-600 dark:text-green-400",
                  )}
                >
                  {hole}
                </TableHead>
              ))}
              <TableHead className="w-9 border-x bg-muted/60 px-1 text-center">
                In
              </TableHead>
              <TableHead className="w-10 bg-muted/60 px-1 text-center">
                Tot
              </TableHead>
              <TableHead className="w-10 px-1 text-center text-muted-foreground">Hcp</TableHead>
              <TableHead className="w-10 px-1 text-center">Net</TableHead>
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
                  {values.scores.slice(0, 9).map((score, index) => (
                    <TableCell
                      key={`${row.round.id}-f${index}`}
                      className="px-1 py-2 text-center tabular-nums"
                    >
                      <HoleScore
                        score={score}
                        par={row.pars[index] ?? null}
                        showSymbol={metric === "strokes"}
                        size="sm"
                      />
                    </TableCell>
                  ))}
                  <ScoreTotalCell value={values.out} className="border-x bg-muted/20" />
                  {values.scores.slice(9).map((score, index) => (
                    <TableCell
                      key={`${row.round.id}-b${index}`}
                      className="px-1 py-2 text-center tabular-nums"
                    >
                      <HoleScore
                        score={score}
                        par={row.pars[index + 9] ?? null}
                        showSymbol={metric === "strokes"}
                        size="sm"
                      />
                    </TableCell>
                  ))}
                  <ScoreTotalCell value={values.in} className="border-x bg-muted/20" />
                  <ScoreTotalCell value={values.total} strong className="bg-muted/20" />
                  <DerivedScoreCell value={row.round.playingHandicap} className="font-normal text-muted-foreground" />
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
  editAccess,
  course,
  rows,
  showMobileTotals,
}: {
  editAccess?: RoundScoresTableProps["editAccess"];
  course: EditableCourse;
  rows: (RoundScoreRow & { round: EditableTableRound })[];
  showMobileTotals: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {rows.map((row) => {
        const canEdit =
          editAccess?.scorableRoundIds.includes(row.round.id) ?? false;
        const canManage =
          editAccess?.manageableRoundIds.includes(row.round.id) ?? false;

        return (
          <RoundScoresCard
            key={row.round.id}
            action={
              canEdit ? (
                <RoundScoresCardEditAction
                  canManage={canManage}
                  round={row.round}
                  course={course}
                />
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

function RoundScoresCardEditAction({
  canManage,
  round,
  course,
}: {
  canManage: boolean;
  round: EditableRound;
  course: EditableCourse;
}) {
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
          canManage={canManage}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onDeleted={() => router.refresh()}
          round={round}
          course={course}
        />
      ) : null}
    </>
  );
}

function ScoreTotalCell({
  value,
  strong,
  className,
}: {
  value: number | null;
  strong?: boolean;
  className?: string;
}) {
  return (
    <TableCell
      className={cn(
        "px-1 py-2 text-center tabular-nums",
        strong ? "font-semibold" : "font-medium",
        className,
      )}
    >
      {formatScore(value)}
    </TableCell>
  );
}

function DerivedScoreCell({
  value,
  strong,
  className,
}: {
  value: number | null;
  strong?: boolean;
  className?: string;
}) {
  return (
    <TableCell
      className={cn(
        "px-1 py-2 text-center tabular-nums",
        strong ? "font-semibold" : "font-medium",
        className,
      )}
    >
      {formatDecimalScore(value)}
    </TableCell>
  );
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
