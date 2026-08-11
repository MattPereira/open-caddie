"use client";

import { HoleScore } from "@/components/features/scores/round-scores-card";
import { cn } from "@/lib/utils";

export type HoleRowCell = {
  id: number;
  playerName: string;
  strokes: number | null;
  putts: number | null;
};

type HoleScoreRowProps = {
  hole: number;
  par: number | null;
  yards: number | null;
  showPutts: boolean;
  highlight: boolean;
  columns: string;
  cells: HoleRowCell[];
  onSelectAction: (id: number) => void;
};

export function HoleScoreRow({
  hole,
  par,
  yards,
  showPutts,
  highlight,
  columns,
  cells,
  onSelectAction,
}: HoleScoreRowProps) {
  return (
    <div
      style={{ gridTemplateColumns: columns }}
      className={cn(
        "grid items-center border-t border-border",
        highlight && "bg-muted/50",
      )}
    >
      {/* The hole number reads as the row's header, so it carries the same
          muted fill and text colour as the column header row. self-stretch fills
          the row height, which items-center would otherwise collapse to text. */}
      <div className="flex self-stretch items-center justify-center bg-muted text-base font-medium tabular-nums text-muted-foreground">
        {hole}
      </div>
      <div className="text-center text-base tabular-nums text-muted-foreground">
        {par ?? "—"}
      </div>
      <div className="text-center text-base tabular-nums text-muted-foreground">
        {yards == null ? "—" : yards.toLocaleString()}
      </div>
      {cells.map((cell) => (
        <button
          key={cell.id}
          type="button"
          onClick={() => onSelectAction(cell.id)}
          aria-label={
            cell.strokes == null
              ? `Add score for ${cell.playerName}, hole ${hole}`
              : `Edit ${cell.playerName}, hole ${hole}, ${cell.strokes} strokes`
          }
          className="relative flex h-14 items-center justify-center border-l border-border transition-colors active:bg-muted"
        >
          {cell.strokes == null ? (
            <span className="size-9 rounded-md border border-dashed border-muted-foreground/40" />
          ) : (
            <HoleScore
              score={cell.strokes}
              par={par}
              showSymbol
              size="lg"
            />
          )}
          {showPutts && cell.putts != null ? (
            <span className="absolute right-1 top-0.5 text-sm tabular-nums text-muted-foreground">
              {cell.putts}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
