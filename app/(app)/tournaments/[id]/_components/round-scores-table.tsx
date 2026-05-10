"use client";

import { useState } from "react";

import {
  formatDecimalScore,
  formatScore,
  HoleScore,
  PlayerLabel,
  RoundScoresCard,
  ScoreMetricSwitch,
  type MetricValues,
  type RoundScoreRow,
  type RoundScoresTableRound,
  type ScoreMetric,
} from "@/components/round-scores-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveTable, TableFrame } from "@/components/responsive-table";
import { displayName, getInitials } from "@/components/player-card";
import { cn } from "@/lib/utils";

export type { RoundScoresTableRound } from "@/components/round-scores-card";

const holes = Array.from({ length: 18 }, (_, index) => index + 1);

type RoundScoresTableProps = {
  rounds: RoundScoresTableRound[];
  showMobileTotals?: boolean;
};

export function RoundScoresTable({
  rounds,
  showMobileTotals = true,
}: RoundScoresTableProps) {
  const rows = rounds.map(toRoundScoreRow);

  return (
    <ResponsiveTable
      desktop={<DesktopRoundScoresTable rows={rows} />}
      mobile={
        <MobileRoundScoresCards
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
              <TableHead className="sticky left-0 z-10 min-w-48 bg-card">
                Player
              </TableHead>
              {holes.map((hole) => (
                <TableHead key={hole} className="w-10 text-center">
                  {hole}
                </TableHead>
              ))}
              <TableHead className="w-12 text-center">Out</TableHead>
              <TableHead className="w-12 text-center">In</TableHead>
              <TableHead className="w-14 text-center">Tot</TableHead>
              <TableHead className="w-16 text-center">Hcp</TableHead>
              <TableHead className="w-14 text-center">Net</TableHead>
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
                  <DerivedScoreCell value={row.round.tournamentHandicap} />
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
  rows,
  showMobileTotals,
}: {
  rows: RoundScoreRow[];
  showMobileTotals: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {rows.map((row) => (
        <RoundScoresCard
          key={row.round.id}
          row={row}
          showMobileTotals={showMobileTotals}
        />
      ))}
    </div>
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

function toRoundScoreRow(round: RoundScoresTableRound): RoundScoreRow {
  const scoresByHole = new Map(
    round.scores.map((score) => [score.hole, score]),
  );
  const player = { ...round, email: null };

  return {
    round,
    playerName: displayName(player),
    initials: getInitials(player),
    pars: holes.map((hole) => scoresByHole.get(hole)?.par ?? null),
    metrics: {
      strokes: toMetricValues(
        holes.map((hole) => scoresByHole.get(hole)?.strokes ?? null),
        toRecordedTotal(round.totalStrokes, round.recordedStrokesCount),
      ),
      putts: toMetricValues(
        holes.map((hole) => scoresByHole.get(hole)?.putts ?? null),
        toRecordedTotal(round.totalPutts, round.recordedPuttsCount),
      ),
    },
  };
}

function toMetricValues(
  scores: (number | null)[],
  total: number | null,
): MetricValues {
  return {
    scores,
    out: sumScores(scores.slice(0, 9)),
    in: sumScores(scores.slice(9)),
    total,
  };
}

function sumScores(scores: (number | null)[]) {
  const recordedScores = scores.filter((score) => score != null);
  if (recordedScores.length === 0) return null;
  return recordedScores.reduce((total, score) => total + score, 0);
}

function toRecordedTotal(total: number, recordedCount: number) {
  return recordedCount === 0 ? null : total;
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
