"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { haptic, type HapticKind } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  EMPTY_GREENIE_DRAFT,
  GreenieInputs,
  type GreenieDraft,
  type GreenieValue,
  isGreenieDraftEmpty,
  parseGreenie,
  toGreenieDraft,
} from "./hole-greenie-manager";

export type ScorePatch = { strokes: number | null; putts: number | null };

// Each grid ends in a "+" tile. Tapping it turns that cell into the next
// number and opens one more row, whose last cell becomes the new "+" — a
// blow-up hole stays one tap away without putting every option on screen.
const STROKE_COLUMNS = 3;
const STROKE_ROWS = 2;
const PUTT_COLUMNS = 3;
const PUTT_ROWS = 2;
const MAX_STROKE_OFFSET = 9;
const MAX_PUTTS = 8;

const PUTT_OPTIONS = Array.from({ length: MAX_PUTTS + 1 }, (_, i) => i);

function strokeOptions(par: number) {
  const first = Math.max(1, par - 2);
  const last = par + MAX_STROKE_OFFSET;
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

// The "+" holds the last cell of the last row, so a page shows one fewer
// number than it has cells.
function pageCount(columns: number, rows: number, page: number) {
  return columns * (rows + page) - 1;
}

function pageForValue(
  options: number[],
  columns: number,
  rows: number,
  value: number | null,
) {
  if (value == null) return 0;
  const index = options.indexOf(value);
  let page = 0;
  while (index >= pageCount(columns, rows, page)) page += 1;
  return page;
}

function strokeLabel(strokes: number, par: number) {
  if (strokes === 1) return "Ace";
  const toPar = strokes - par;
  if (toPar <= -3) return "Albatross";
  if (toPar === -2) return "Eagle";
  if (toPar === -1) return "Birdie";
  if (toPar === 0) return "Par";
  if (toPar === 1) return "Bogey";
  if (toPar === 2) return "Double";
  if (toPar === 3) return "Triple";
  if (toPar === 4) return "Quadruple";
  return `+${toPar}`;
}

type ScoreEntrySheetProps = {
  open: boolean;
  hole: number;
  par: number;
  playerName: string;
  strokes: number | null;
  putts: number | null;
  greenie: GreenieValue | null;
  showPutts: boolean;
  showGreenie: boolean;
  onOpenChangeAction: (open: boolean) => void;
  onSubmitAction: (patch: ScorePatch) => void;
  onGreenieSaveAction: (value: GreenieValue) => void;
  onGreenieDeleteAction: () => void;
};

export function ScoreEntrySheet({
  open,
  hole,
  par,
  playerName,
  strokes,
  putts,
  greenie,
  showPutts,
  showGreenie,
  onOpenChangeAction,
  onSubmitAction,
  onGreenieSaveAction,
  onGreenieDeleteAction,
}: ScoreEntrySheetProps) {
  // Mounted only while a cell is active, so mount-time props are the open state.
  const allStrokeOptions = strokeOptions(par);
  const [draft, setDraft] = useState<ScorePatch>({ strokes, putts });
  // A saved score past the first page opens expanded, or a scored hole would
  // come back looking empty.
  const [strokePage, setStrokePage] = useState(() =>
    pageForValue(allStrokeOptions, STROKE_COLUMNS, STROKE_ROWS, strokes),
  );
  const [puttPage, setPuttPage] = useState(() =>
    pageForValue(PUTT_OPTIONS, PUTT_COLUMNS, PUTT_ROWS, putts),
  );
  const [greenieDraft, setGreenieDraft] = useState<GreenieDraft>(() =>
    toGreenieDraft(greenie),
  );
  const draftRef = useRef<ScorePatch>({ strokes, putts });
  const savedRef = useRef<ScorePatch>({ strokes, putts });
  const greenieDraftRef = useRef<GreenieDraft>(toGreenieDraft(greenie));
  const savedGreenieRef = useRef<GreenieValue | null>(greenie);

  const applyDraft = (next: ScorePatch) => {
    draftRef.current = next;
    setDraft(next);
  };

  const applyGreenieDraft = (next: GreenieDraft) => {
    greenieDraftRef.current = next;
    setGreenieDraft(next);
  };

  // Everything on this sheet is one gesture: closing writes the score patch and
  // the greenie together, so a caller sees at most one of each per visit.
  const commitGreenie = () => {
    const saved = savedGreenieRef.current;
    const next = parseGreenie(greenieDraftRef.current);
    if (next != null) {
      const same =
        saved != null &&
        saved.feet === next.feet &&
        saved.inches === next.inches;
      if (!same) {
        savedGreenieRef.current = next;
        onGreenieSaveAction(next);
        return true;
      }
      return false;
    }
    if (saved != null && isGreenieDraftEmpty(greenieDraftRef.current)) {
      savedGreenieRef.current = null;
      onGreenieDeleteAction();
      return true;
    }
    return false;
  };

  // One cue per gesture: the terminal action wins. Callers that persist
  // something outside the score patch pass their own cue; otherwise the confirm
  // buzz rides the same condition as the write, so swiping the sheet away
  // unchanged stays silent rather than claiming a save that never happened.
  const commitAndClose = (cue?: HapticKind) => {
    const next = draftRef.current;
    const saved = savedRef.current;
    const scoreChanged =
      next.strokes !== saved.strokes || next.putts !== saved.putts;
    if (scoreChanged) {
      savedRef.current = next;
      onSubmitAction(next);
    }
    const greenieChanged = showGreenie ? commitGreenie() : false;
    const feedback = cue ?? (scoreChanged || greenieChanged ? "commit" : null);
    if (feedback) haptic(feedback);
    onOpenChangeAction(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChangeAction(true);
      return;
    }
    commitAndClose();
  };

  // With only strokes on the sheet there is nothing left to enter, so the tap
  // that picks a score is also the tap that closes.
  const closesOnStroke = !showPutts && !showGreenie;

  const handleStrokes = (value: number) => {
    applyDraft({ strokes: value, putts: draftRef.current.putts });
    if (closesOnStroke) {
      commitAndClose();
      return;
    }
    haptic("tick");
  };

  const handlePutts = (value: number) => {
    applyDraft({ strokes: draftRef.current.strokes, putts: value });
    haptic("tick");
  };

  const handleClear = () => {
    applyDraft({ strokes: null, putts: null });
    applyGreenieDraft(EMPTY_GREENIE_DRAFT);
    commitAndClose("clear");
  };

  const hasGreenie = greenie != null || !isGreenieDraftEmpty(greenieDraft);
  const showClear =
    draft.strokes != null || draft.putts != null || (showGreenie && hasGreenie);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[90svh] gap-10 overflow-y-auto rounded-t-2xl px-5 pb-8 pt-5"
      >
        <SheetHeader className="flex-row items-baseline justify-between gap-3 p-0">
          <SheetTitle className="min-w-0 truncate font-heading text-xl font-semibold">
            {playerName}
          </SheetTitle>
          <span className="shrink-0 font-heading text-xl font-semibold">Hole {hole}</span>
        </SheetHeader>

        <section className="flex flex-col gap-2">
          <SheetDescription className="text-sm font-medium uppercase tracking-wide">
            Strokes
          </SheetDescription>
          <OptionGrid
            className="grid-cols-3"
            options={allStrokeOptions}
            count={pageCount(STROKE_COLUMNS, STROKE_ROWS, strokePage)}
            labelFor={(value) => strokeLabel(value, par)}
            selected={draft.strokes}
            onSelectAction={handleStrokes}
            onMoreAction={() => setStrokePage(strokePage + 1)}
          />
        </section>

        {showPutts ? (
          <section className="flex flex-col gap-2">
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Putts
            </p>
            <OptionGrid
              className="grid-cols-3"
              options={PUTT_OPTIONS}
              count={pageCount(PUTT_COLUMNS, PUTT_ROWS, puttPage)}
              selected={draft.putts}
              onSelectAction={handlePutts}
              onMoreAction={() => setPuttPage(puttPage + 1)}
            />
          </section>
        ) : null}

        {showGreenie ? (
          <section className="flex flex-col gap-2">
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Greenie
            </p>
            <GreenieInputs
              hole={hole}
              idPrefix={`sheet-hole-${hole}`}
              draft={greenieDraft}
              onChangeAction={applyGreenieDraft}
            />
          </section>
        ) : null}

        {/* Same 3-up grid as the tiles, so the actions line up with the
            columns above instead of merely being close. */}
        <div className="grid grid-cols-3 gap-2">
          {showClear ? (
            <Button
              type="button"
              variant="destructive"
              size="2xl"
              className="col-start-1 w-full"
              onClick={handleClear}
            >
              Clear
            </Button>
          ) : null}
          {closesOnStroke ? null : (
            <Button
              type="button"
              size="2xl"
              className="col-start-3 w-full"
              onClick={() => commitAndClose()}
            >
              Done
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function OptionGrid({
  className,
  options,
  count,
  labelFor,
  selected,
  onSelectAction,
  onMoreAction,
}: {
  className: string;
  options: number[];
  count: number;
  labelFor?: (value: number) => string;
  selected: number | null;
  onSelectAction: (value: number) => void;
  onMoreAction: () => void;
}) {
  // A "+" that would reveal a single number is wasted: when only one option
  // sits behind it, show that option in its place.
  const hasMore = count + 1 < options.length;
  const visible = hasMore ? options.slice(0, count) : options;
  return (
    <div className={cn("grid gap-2", className)}>
      {visible.map((value) => (
        <ChoiceButton
          key={value}
          value={value}
          label={labelFor?.(value)}
          selected={selected === value}
          onSelectAction={onSelectAction}
        />
      ))}
      {hasMore ? (
        <Button
          type="button"
          variant="outline"
          aria-label="Show higher options"
          className={cn(
            "flex items-center justify-center px-0 text-2xl font-semibold leading-none text-muted-foreground",
            labelFor ? "h-20" : "h-16",
          )}
          onClick={() => {
            haptic("tick");
            onMoreAction();
          }}
        >
          +
        </Button>
      ) : null}
    </div>
  );
}

function ChoiceButton({
  value,
  label,
  selected,
  onSelectAction,
}: {
  value: number;
  label?: string;
  selected: boolean;
  onSelectAction: (value: number) => void;
}) {
  return (
    <Button
      type="button"
      // Selected drops the outline variant rather than overriding it: outline
      // carries its own dark: background, which would beat any plain colour
      // set here and leave the tile looking unselected in dark mode.
      variant={selected ? "secondary" : "outline"}
      className={cn(
        "flex flex-col items-center justify-center gap-1 px-0",
        label ? "h-20" : "h-16",
        // Neutral inversion for state, so green stays the action colour.
        selected &&
          "border-transparent bg-foreground/85 text-background hover:bg-foreground/80",
      )}
      onClick={() => onSelectAction(value)}
    >
      <span className="text-2xl font-semibold tabular-nums leading-none">
        {value}
      </span>
      {label ? (
        <span className="text-xs font-medium uppercase tracking-wide leading-none opacity-70">
          {label}
        </span>
      ) : null}
    </Button>
  );
}
