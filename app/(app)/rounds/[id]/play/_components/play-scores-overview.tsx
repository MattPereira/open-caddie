"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { ScoreEntry } from "./round-score-state";

type PlayScoresOverviewProps = {
  scores: ScoreEntry[];
  currentHole: number;
  greenieHoles?: Set<number>;
};

const frontNine = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const backNine = [10, 11, 12, 13, 14, 15, 16, 17, 18];

export function PlayScoresOverview({
  scores,
  currentHole,
  greenieHoles = new Set(),
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

  const scoreByHole = new Map(scores.map((s) => [s.hole, s]));

  const nineStrokes = nineHoles.map((h) => scoreByHole.get(h)?.strokes ?? null);
  const ninePutts = nineHoles.map((h) => scoreByHole.get(h)?.putts ?? null);
  const strokeTotal = sumNonNull(nineStrokes);
  const puttTotal = sumNonNull(ninePutts);

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

      <div className="grid grid-cols-10 overflow-hidden rounded-lg ring-1 ring-border">
        {/* Hole header row */}
        {nineHoles.map((hole) => (
          <Cell
            key={`h-${hole}`}
            muted
            header
            highlight={hole === currentHole}
            greenie={greenieHoles.has(hole) && hole !== currentHole}
          >
            {hole}
          </Cell>
        ))}
        <Cell muted header>{totalLabel}</Cell>

        {/* Strokes row */}
        {nineHoles.map((hole) => (
          <Cell key={`s-${hole}`} bordered highlight={hole === currentHole}>
            {scoreByHole.get(hole)?.strokes ?? null}
          </Cell>
        ))}
        <Cell bordered total>{strokeTotal}</Cell>

        {/* Putts row */}
        {nineHoles.map((hole) => (
          <Cell key={`p-${hole}`} bordered highlight={hole === currentHole}>
            {scoreByHole.get(hole)?.putts ?? null}
          </Cell>
        ))}
        <Cell bordered total>{puttTotal}</Cell>
      </div>
    </div>
  );
}

function Cell({
  children,
  muted,
  header,
  bordered,
  highlight,
  greenie,
  total,
}: {
  children?: ReactNode;
  muted?: boolean;
  header?: boolean;
  bordered?: boolean;
  highlight?: boolean;
  greenie?: boolean;
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
        greenie
          ? "font-bold text-green-600 dark:text-green-400"
          : header && highlight
            ? "font-bold text-foreground"
            : header
              ? "text-muted-foreground"
              : highlight
                ? "font-semibold text-foreground"
                : total
                  ? "font-semibold"
                  : "font-medium",
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
