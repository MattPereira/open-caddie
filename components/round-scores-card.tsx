"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { displayName, getInitials } from "@/components/player-card";
import { cn } from "@/lib/utils";

const holes = Array.from({ length: 18 }, (_, index) => index + 1);
const frontNine = holes.slice(0, 9);
const backNine = holes.slice(9);

export type RoundScoresTableRound = {
  id: number;
  tournamentId?: number | null;
  userId?: string;
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
    par: number | null;
    strokes: number | null;
    putts: number | null;
  }[];
  holes?: {
    hole: number;
    par: number;
  }[];
  greenies?: {
    hole: number;
    feet: number;
    inches: number;
  }[];
};

export type ScoreMetric = "strokes" | "putts";

export type MetricValues = {
  scores: (number | null)[];
  out: number | null;
  in: number | null;
  total: number | null;
};

export type RoundScoreRow = {
  round: RoundScoresTableRound;
  playerName: string;
  initials: string;
  pars: (number | null)[];
  metrics: Record<ScoreMetric, MetricValues>;
};

type ScoreSymbol =
  | "double-circle"
  | "circle"
  | "none"
  | "square"
  | "double-square";

export function toRoundScoreRow(round: RoundScoresTableRound): RoundScoreRow {
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

export function RoundScoresCard({
  action,
  row,
  showMobileTotals,
}: {
  action?: ReactNode;
  row: RoundScoreRow;
  showMobileTotals: boolean;
}) {
  const [metric, setMetric] = useState<ScoreMetric>("strokes");
  const values = row.metrics[metric];

  return (
    <Card size="sm" className="min-w-0">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="min-w-0 flex-1">
          <PlayerLabel row={row} />
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {showMobileTotals ? (
          <div className="grid min-w-0 grid-cols-4 gap-2">
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
        ) : null}

        <MobileScoreLine
          holes={frontNine}
          values={values.scores}
          pars={row.pars}
          showSymbols={metric === "strokes"}
          totalLabel="Out"
          totalValue={values.out}
          roundId={row.round.id}
        />
        <MobileScoreLine
          holes={backNine}
          values={values.scores}
          pars={row.pars}
          showSymbols={metric === "strokes"}
          totalLabel="In"
          totalValue={values.in}
          roundId={row.round.id}
        />
        <div className="flex w-full justify-end">
          <ScoreMetricSwitch
            id={`round-${row.round.id}-score-metric`}
            metric={metric}
            onMetricChange={setMetric}
            size="sm"
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function PlayerLabel({ row }: { row: RoundScoreRow }) {
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

export function ScoreMetricSwitch({
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

function MobileScoreLine({
  holes,
  values,
  pars,
  showSymbols,
  totalLabel,
  totalValue,
  roundId,
}: {
  holes: number[];
  values: (number | null)[];
  pars: (number | null)[];
  showSymbols: boolean;
  totalLabel: string;
  totalValue: number | null;
  roundId: number;
}) {
  return (
    <div>
      <div className="grid min-w-0 grid-cols-10 overflow-hidden rounded-lg ring-1 ring-border">
        {holes.map((hole) => (
          <div
            key={`${roundId}-${hole}-header`}
            className="min-w-0 bg-muted px-1 py-1 text-center text-xs font-medium text-muted-foreground"
          >
            {hole}
          </div>
        ))}
        <div className="min-w-0 bg-muted px-1 py-1 text-center text-xs font-medium text-muted-foreground">
          {totalLabel}
        </div>
        {holes.map((hole) => (
          <div
            key={`${roundId}-${hole}-score`}
            className="flex min-w-0 justify-center px-1 py-1.5 text-center text-sm font-medium tabular-nums"
          >
            <HoleScore
              score={values[hole - 1]}
              par={pars[hole - 1] ?? null}
              showSymbol={showSymbols}
              size="sm"
            />
          </div>
        ))}
        <div className="min-w-0 px-1 py-1.5 text-center text-sm font-semibold tabular-nums">
          {formatScore(totalValue)}
        </div>
      </div>
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
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-muted px-2 py-2">
      <span className="truncate text-xs font-medium text-muted-foreground">
        {label}
      </span>
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

export function HoleScore({
  score,
  par,
  showSymbol,
  size = "default",
}: {
  score: number | null;
  par: number | null;
  showSymbol: boolean;
  size?: "default" | "sm";
}) {
  const symbol =
    showSymbol && score != null && par != null
      ? getScoreSymbol(score, par)
      : "none";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center border-current leading-none tabular-nums",
        size === "sm" ? "size-6 text-sm" : "size-7 text-sm",
        symbol === "circle" && "rounded-full border",
        symbol === "double-circle" && "rounded-full border-[3px] border-double",
        symbol === "square" && "rounded-sm border",
        symbol === "double-square" && "rounded-sm border-[3px] border-double",
      )}
    >
      {formatScore(score)}
    </span>
  );
}

export function formatScore(score: number | null) {
  return score == null ? "—" : score;
}

export function formatDecimalScore(score: number | null) {
  return score == null ? "—" : score.toFixed(1);
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

function getScoreSymbol(score: number, par: number): ScoreSymbol {
  const scoreToPar = score - par;

  if (scoreToPar <= -2) return "double-circle";
  if (scoreToPar === -1) return "circle";
  if (scoreToPar === 1) return "square";
  if (scoreToPar >= 2) return "double-square";
  return "none";
}
