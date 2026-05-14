"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type {
  RoundScoreRow,
  ScoreMetric,
} from "@/components/round-scores-card-row";

export type {
  MetricValues,
  RoundScoreRow,
  RoundScoresTableRound,
  ScoreMetric,
} from "@/components/round-scores-card-row";
import { StatTile } from "./stat-tile";

const holes = Array.from({ length: 18 }, (_, index) => index + 1);
const frontNine = holes.slice(0, 9);
const backNine = holes.slice(9);

type ScoreSymbol =
  | "double-circle"
  | "circle"
  | "none"
  | "square"
  | "double-square";

export function RoundScoresCard({
  action,
  row,
  showMobileTotals,
  visibleNine = "both",
}: {
  action?: ReactNode;
  row: RoundScoreRow;
  showMobileTotals: boolean;
  visibleNine?: "front" | "back" | "both";
}) {
  const [metric, setMetric] = useState<ScoreMetric>("strokes");
  const values = row.metrics[metric];
  const greenieHoles = new Set(
    row.round.greenies?.map((greenie) => greenie.hole) ?? [],
  );

  return (
    <Card size="sm" className="min-w-0 max-w-lg gap-1.5! py-2!">
      <CardHeader className="flex justify-between items-center gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <CardTitle className="min-w-0">
            <PlayerLabel row={row} />
          </CardTitle>
          {action}
        </div>

        <ScoreMetricSwitch
          id={`round-${row.round.id}-score-metric`}
          metric={metric}
          onMetricChange={setMetric}
          size="sm"
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-2!">
        {showMobileTotals ? (
          <div className="grid min-w-0 grid-cols-4 gap-2">
            <StatTile label="Putts" value={row.metrics.putts.total} />
            <StatTile label="Strokes" value={row.metrics.strokes.total} />
            <StatTile
              label="Hcp"
              value={formatDecimalScore(row.round.tournamentHandicap)}
            />
            <StatTile
              label="Net"
              value={formatDecimalScore(row.round.netStrokes)}
            />
          </div>
        ) : null}

        {visibleNine !== "back" ? (
          <MobileScoreLine
            holes={frontNine}
            values={values.scores}
            pars={row.pars}
            showSymbols={metric === "strokes"}
            totalLabel="Out"
            totalValue={values.out}
            roundId={row.round.id}
            greenieHoles={greenieHoles}
          />
        ) : null}
        {visibleNine !== "front" ? (
          <MobileScoreLine
            holes={backNine}
            values={values.scores}
            pars={row.pars}
            showSymbols={metric === "strokes"}
            totalLabel="In"
            totalValue={values.in}
            roundId={row.round.id}
            greenieHoles={greenieHoles}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

export function PlayerLabel({ row }: { row: RoundScoreRow }) {
  const label = (
    <div className="flex min-w-0 items-center gap-2">
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
  greenieHoles,
}: {
  holes: number[];
  values: (number | null)[];
  pars: (number | null)[];
  showSymbols: boolean;
  totalLabel: string;
  totalValue: number | null;
  roundId: number;
  greenieHoles: Set<number>;
}) {
  return (
    <div>
      <div className="grid min-w-0 grid-cols-10 overflow-hidden rounded-lg ring-1 ring-border">
        {holes.map((hole) => (
          <div
            key={`${roundId}-${hole}-header`}
            className={cn(
              "min-w-0 bg-muted px-1 py-1 text-center text-xs font-medium text-muted-foreground",
              greenieHoles.has(hole) &&
                "text-green-600 font-bold dark:text-green-400",
            )}
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

function getScoreSymbol(score: number, par: number): ScoreSymbol {
  const scoreToPar = score - par;

  if (scoreToPar <= -2) return "double-circle";
  if (scoreToPar === -1) return "circle";
  if (scoreToPar === 1) return "square";
  if (scoreToPar >= 2) return "double-square";
  return "none";
}
