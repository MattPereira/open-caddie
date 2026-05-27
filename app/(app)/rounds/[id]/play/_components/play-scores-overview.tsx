"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { HoleScore } from "@/components/round-scores-card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { ScoreEntry } from "./round-score-state";

export type PlayerRows = {
  key: string;
  label: string;
  scores: ScoreEntry[];
};

type PlayScoresOverviewProps = {
  players: PlayerRows[];
  currentHole: number;
  showPutts?: boolean;
};

const frontNine = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const backNine = [10, 11, 12, 13, 14, 15, 16, 17, 18];

export function PlayScoresOverview({
  players,
  currentHole,
  showPutts = true,
}: PlayScoresOverviewProps) {
  const [visibleNine, setVisibleNine] = useState<"front" | "back">(
    currentHole > 9 ? "back" : "front",
  );
  const prevIsBack = useRef(currentHole > 9);

  useEffect(() => {
    const isBack = currentHole > 9;
    if (isBack !== prevIsBack.current) {
      setVisibleNine(isBack ? "back" : "front");
      prevIsBack.current = isBack;
    }
  }, [currentHole]);

  const nineHoles = visibleNine === "back" ? backNine : frontNine;
  const totalLabel = visibleNine === "back" ? "In" : "Out";

  return (
    <div className="relative">
      <div className="absolute bottom-full right-0 mb-3 flex shrink-0 items-center gap-2 text-xs">
        <span
          className={cn(
            "font-medium",
            visibleNine === "front" ? "text-foreground" : "text-muted-foreground",
          )}
        >
          Out
        </span>
        <Switch
          id="nine-switch"
          size="sm"
          checked={visibleNine === "back"}
          onCheckedChange={(checked) => setVisibleNine(checked ? "back" : "front")}
          aria-label="Switch between front and back nine"
        />
        <label
          htmlFor="nine-switch"
          className={cn(
            "font-medium",
            visibleNine === "back" ? "text-foreground" : "text-muted-foreground",
          )}
        >
          In
        </label>
      </div>

      <div className="grid grid-cols-11 overflow-hidden rounded-lg ring-1 ring-border">
        <Cell muted header>{false}</Cell>
        {nineHoles.map((hole) => (
          <Cell
            key={`h-${hole}`}
            muted
            header
            highlight={hole === currentHole}
          >
            {hole}
          </Cell>
        ))}
        <Cell muted header>{totalLabel}</Cell>

        {players.map((player) => {
          const scoreByHole = new Map(
            player.scores.map((entry) => [entry.hole, entry]),
          );
          const pars = nineHoles.map(
            (hole) => scoreByHole.get(hole)?.par ?? null,
          );
          const nineStrokes = nineHoles.map(
            (hole) => scoreByHole.get(hole)?.strokes ?? null,
          );
          const ninePutts = nineHoles.map(
            (hole) => scoreByHole.get(hole)?.putts ?? null,
          );
          const strokeTotal = sumNonNull(nineStrokes);
          const puttTotal = sumNonNull(ninePutts);

          return (
            <PlayerSection
              key={player.key}
              nineHoles={nineHoles}
              currentHole={currentHole}
              playerKey={player.key}
              label={player.label}
              pars={pars}
              strokes={nineStrokes}
              putts={ninePutts}
              strokeTotal={strokeTotal}
              puttTotal={puttTotal}
              showPutts={showPutts}
            />
          );
        })}
      </div>
    </div>
  );
}

function PlayerSection({
  nineHoles,
  currentHole,
  playerKey,
  label,
  pars,
  strokes,
  putts,
  strokeTotal,
  puttTotal,
  showPutts,
}: {
  nineHoles: number[];
  currentHole: number;
  playerKey: string;
  label: string;
  pars: (number | null)[];
  strokes: (number | null)[];
  putts: (number | null)[];
  strokeTotal: number | null;
  puttTotal: number | null;
  showPutts: boolean;
}) {
  const initials = label
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <div
        className={cn(
          "flex items-center justify-center border-t border-border bg-muted px-0.5 text-xs font-semibold text-muted-foreground",
          showPutts ? "row-span-2" : "",
        )}
      >
        {initials}
      </div>

      {nineHoles.map((hole, index) => (
        <Cell
          key={`s-${playerKey}-${hole}`}
          bordered
          highlight={hole === currentHole}
        >
          <HoleScore
            score={strokes[index]}
            par={pars[index]}
            showSymbol
            size="sm"
          />
        </Cell>
      ))}
      <Cell bordered total>
        {strokeTotal}
      </Cell>

      {showPutts && (
        <>
          {nineHoles.map((hole, index) => (
            <Cell
              key={`p-${playerKey}-${hole}`}
              bordered
              highlight={hole === currentHole}
            >
              {putts[index]}
            </Cell>
          ))}
          <Cell bordered total>
            {puttTotal}
          </Cell>
        </>
      )}
    </>
  );
}

function Cell({
  children,
  muted,
  header,
  bordered,
  highlight,
  total,
}: {
  children?: ReactNode;
  muted?: boolean;
  header?: boolean;
  bordered?: boolean;
  highlight?: boolean;
  total?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center justify-center px-0.5 tabular-nums",
        header ? "py-1.5 text-sm font-medium" : "py-2 text-base",
        muted && !highlight ? "bg-muted" : "",
        highlight ? "bg-muted/60" : "",
        bordered && "border-t border-border",
        header && highlight
          ? "font-bold text-foreground"
          : header
            ? "text-muted-foreground"
            : highlight
              ? "font-semibold text-foreground"
              : total
                ? "font-semibold"
                : "font-normal",
      )}
    >
      {children ?? "—"}
    </div>
  );
}

function sumNonNull(values: (number | null)[]) {
  const nonNull = values.filter((v): v is number => v != null);
  return nonNull.length === 0 ? null : nonNull.reduce((s, v) => s + v, 0);
}
