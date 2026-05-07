"use client";

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
import type { getTournamentById } from "@/db/queries/tournaments";
import { cn } from "@/lib/utils";

type Tournament = NonNullable<Awaited<ReturnType<typeof getTournamentById>>>;
type Round = Tournament["rounds"][number];

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
  round: Round;
  playerName: string;
  initials: string;
  metrics: Record<ScoreMetric, MetricValues>;
};

export function RoundScoresTable({ rounds }: { rounds: Round[] }) {
  const rows = rounds
    .map(toRoundScoreRow)
    .sort((a, b) => compareRoundScoreRows(a, b, "strokes"));

  return (
    <ResponsiveTable
      desktop={<DesktopRoundScoresTable rows={rows} />}
      mobile={<MobileRoundScoresCards rows={rows} />}
    />
  );
}

function DesktopRoundScoresTable({ rows }: { rows: RoundScoreRow[] }) {
  const [metric, setMetric] = useState<ScoreMetric>("strokes");
  const sortedRows = [...rows].sort((a, b) =>
    compareRoundScoreRows(a, b, metric),
  );

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
          label="Out"
          holes={frontNine}
          values={values.scores}
          roundId={row.round.id}
        />
        <MobileScoreLine
          label="In"
          holes={backNine}
          values={values.scores}
          roundId={row.round.id}
        />
        <div className="grid grid-cols-3 gap-2">
          <MobileTotal label="Out" value={values.out} />
          <MobileTotal label="In" value={values.in} />
          <MobileTotal label="Total" value={values.total} strong />
        </div>
      </CardContent>
    </Card>
  );
}

function PlayerLabel({ row }: { row: RoundScoreRow }) {
  return (
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
}

function MobileScoreLine({
  label,
  holes,
  values,
  roundId,
}: {
  label: string;
  holes: number[];
  values: (number | null)[];
  roundId: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="grid grid-cols-9 overflow-hidden rounded-lg ring-1 ring-border">
        {holes.map((hole) => (
          <div
            key={`${roundId}-${hole}-header`}
            className="bg-muted px-1.5 py-1 text-center text-xs font-medium text-muted-foreground"
          >
            {hole}
          </div>
        ))}
        {holes.map((hole) => (
          <div
            key={`${roundId}-${hole}-score`}
            className="px-1.5 py-1.5 text-center text-sm font-medium tabular-nums"
          >
            {formatScore(values[hole - 1])}
          </div>
        ))}
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
  strong,
}: {
  label: string;
  value: number | null;
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
        {formatScore(value)}
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

function toRoundScoreRow(round: Round): RoundScoreRow {
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
      ),
      putts: toMetricValues(
        holes.map((hole) => scoresByHole.get(hole)?.putts ?? null),
      ),
    },
  };
}

function toMetricValues(scores: (number | null)[]): MetricValues {
  return {
    scores,
    out: sumScores(scores.slice(0, 9)),
    in: sumScores(scores.slice(9)),
    total: sumScores(scores),
  };
}

function sumScores(scores: (number | null)[]) {
  const recordedScores = scores.filter((score) => score != null);
  if (recordedScores.length === 0) return null;
  return recordedScores.reduce((total, score) => total + score, 0);
}

function formatScore(score: number | null) {
  return score == null ? "—" : score;
}

function compareRoundScoreRows(
  a: RoundScoreRow,
  b: RoundScoreRow,
  metric: ScoreMetric,
) {
  const totalA = a.metrics[metric].total;
  const totalB = b.metrics[metric].total;

  if (totalA == null && totalB == null) {
    return a.playerName.localeCompare(b.playerName);
  }

  if (totalA == null) return 1;
  if (totalB == null) return -1;

  const totalCompare = totalA - totalB;
  if (totalCompare !== 0) return totalCompare;

  return a.playerName.localeCompare(b.playerName);
}
