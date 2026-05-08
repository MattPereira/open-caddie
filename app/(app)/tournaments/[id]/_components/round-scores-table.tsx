"use client";

import Link from "next/link";
import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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

export type RoundScoresTableRound = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  image: string | null;
  recordedStrokesCount: number;
  recordedPuttsCount: number;
  totalStrokes: number;
  totalPutts: number;
  tournamentHandicap: number | null;
  netStrokes: number | null;
  scores: {
    hole: number;
    strokes: number | null;
    putts: number | null;
  }[];
};

const holes = Array.from({ length: 18 }, (_, index) => index + 1);
const frontNine = holes.slice(0, 9);
const backNine = holes.slice(9);

type ScoreMetric = "strokes" | "putts";

type MetricValues = {
  scores: (number | null)[];
  out: number | null;
  in: number | null;
  total: number | null;
};

type RoundScoreRow = {
  round: RoundScoresTableRound;
  playerName: string;
  initials: string;
  metrics: Record<ScoreMetric, MetricValues>;
};

export function RoundScoresTable({
  rounds,
}: {
  rounds: RoundScoresTableRound[];
}) {
  const rows = rounds.map(toRoundScoreRow);

  return (
    <ResponsiveTable
      desktop={<DesktopRoundScoresTable rows={rows} />}
      mobile={<MobileRoundScoresCards rows={rows} />}
    />
  );
}

function DesktopRoundScoresTable({ rows }: { rows: RoundScoreRow[] }) {
  const [metric, setMetric] = useState<ScoreMetric>("strokes");
  const sortedRows =
    metric === "strokes"
      ? rows
      : [...rows].sort(compareRoundScoreRowsByPutts);

  return (
    <div className="flex w-fit max-w-full flex-col gap-3">
      <div className="flex w-full justify-end">
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
              <TableHead className="w-14 text-center">Total</TableHead>
              <TableHead className="w-16 text-center">HCP</TableHead>
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
                      {formatScore(score)}
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

function MobileRoundScoresCards({ rows }: { rows: RoundScoreRow[] }) {
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <MobileRoundScoresCard key={row.round.id} row={row} />
      ))}
    </div>
  );
}

function MobileRoundScoresCard({ row }: { row: RoundScoreRow }) {
  const [metric, setMetric] = useState<ScoreMetric>("strokes");
  const values = row.metrics[metric];

  return (
    <Card size="sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="min-w-0">
          <PlayerLabel row={row} />
        </CardTitle>
        <ScoreMetricSwitch
          id={`round-${row.round.id}-score-metric`}
          metric={metric}
          onMetricChange={setMetric}
          size="sm"
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <MobileScoreLine
          holes={frontNine}
          values={values.scores}
          totalLabel="Out"
          totalValue={values.out}
          roundId={row.round.id}
        />
        <MobileScoreLine
          holes={backNine}
          values={values.scores}
          totalLabel="In"
          totalValue={values.in}
          roundId={row.round.id}
        />
        <div className="grid grid-cols-4 gap-2">
          <MobileTotal label="Putts" value={row.metrics.putts.total} />
          <MobileTotal
            label="Strokes"
            value={row.metrics.strokes.total}
            strong
          />
          <MobileTotal
            label="Handicap"
            value={row.round.tournamentHandicap}
            format="decimal"
          />
          <MobileTotal
            label="Net"
            value={row.round.netStrokes}
            format="decimal"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function PlayerLabel({ row }: { row: RoundScoreRow }) {
  const label = (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar size="sm">
        {row.round.image ? (
          <AvatarImage src={row.round.image} alt={row.playerName} />
        ) : null}
        <AvatarFallback>{row.initials}</AvatarFallback>
      </Avatar>
      <span className="truncate">{row.playerName}</span>
    </div>
  );

  return (
    <Link
      href={`/rounds/${row.round.id}`}
      className="block min-w-0 rounded-md hover:underline"
    >
      {label}
    </Link>
  );
}

function MobileScoreLine({
  holes,
  values,
  totalLabel,
  totalValue,
  roundId,
}: {
  holes: number[];
  values: (number | null)[];
  totalLabel: string;
  totalValue: number | null;
  roundId: number;
}) {
  return (
    <div>
      <div className="grid grid-cols-10 overflow-hidden rounded-lg ring-1 ring-border">
        {holes.map((hole) => (
          <div
            key={`${roundId}-${hole}-header`}
            className="bg-muted px-1.5 py-1 text-center text-xs font-medium text-muted-foreground"
          >
            {hole}
          </div>
        ))}
        <div className="bg-muted px-1.5 py-1 text-center text-xs font-medium text-muted-foreground">
          {totalLabel}
        </div>
        {holes.map((hole) => (
          <div
            key={`${roundId}-${hole}-score`}
            className="px-1.5 py-1.5 text-center text-sm font-medium tabular-nums"
          >
            {formatScore(values[hole - 1])}
          </div>
        ))}
        <div className="px-1.5 py-1.5 text-center text-sm font-semibold tabular-nums">
          {formatScore(totalValue)}
        </div>
      </div>
    </div>
  );
}

function ScoreMetricSwitch({
  id,
  metric,
  onMetricChange,
  size = "default",
}: {
  id: string;
  metric: ScoreMetric;
  onMetricChange: (metric: ScoreMetric) => void;
  size?: "default" | "sm";
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2",
        size === "sm" ? "text-xs" : "text-sm",
      )}
    >
      <span
        className={cn(
          "font-medium",
          metric === "strokes" ? "text-foreground" : "text-muted-foreground",
        )}
      >
        Strokes
      </span>
      <Switch
        id={id}
        size={size}
        checked={metric === "putts"}
        onCheckedChange={(checked) =>
          onMetricChange(checked ? "putts" : "strokes")
        }
        aria-label="Switch between strokes and putts"
      />
      <label
        htmlFor={id}
        className={cn(
          "font-medium",
          metric === "putts" ? "text-foreground" : "text-muted-foreground",
        )}
      >
        Putts
      </label>
    </div>
  );
}

function MobileTotal({
  label,
  value,
  format = "score",
  strong,
}: {
  label: string;
  value: number | null;
  format?: "score" | "decimal";
  strong?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-muted px-3 py-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-right text-sm tabular-nums text-card-foreground",
          strong ? "font-semibold" : "font-medium",
        )}
      >
        {format === "decimal" ? formatDecimalScore(value) : formatScore(value)}
      </span>
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

function formatScore(score: number | null) {
  return score == null ? "—" : score;
}

function formatDecimalScore(score: number | null) {
  return score == null ? "—" : score.toFixed(1);
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
