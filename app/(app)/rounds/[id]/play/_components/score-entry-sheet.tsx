"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
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

type Step = "strokes" | "putts" | "greenie";

const STROKE_OFFSETS = [-2, -1, 0, 1, 2, 3];
const EXTRA_STROKE_OFFSETS = [4, 5, 6, 7, 8, 9];
const PUTT_OPTIONS = [0, 1, 2, 3, 4];
const EXTRA_PUTT_OPTIONS = [5, 6, 7, 8, 9];

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
  return `+${toPar}`;
}

function strokeOptions(par: number, offsets: number[]) {
  const seen = new Set<number>();
  return offsets
    .map((offset) => par + offset)
    .filter((strokes) => {
      if (strokes < 1 || seen.has(strokes)) return false;
      seen.add(strokes);
      return true;
    });
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
  const [step, setStep] = useState<Step>("strokes");
  const [showMore, setShowMore] = useState(false);
  const [draft, setDraft] = useState<ScorePatch>({ strokes, putts });
  const [greenieDraft, setGreenieDraft] = useState<GreenieDraft>(() =>
    toGreenieDraft(greenie),
  );
  const draftRef = useRef<ScorePatch>({ strokes, putts });
  const savedRef = useRef<ScorePatch>({ strokes, putts });

  const applyDraft = (next: ScorePatch) => {
    draftRef.current = next;
    setDraft(next);
  };

  const commitAndClose = () => {
    const next = draftRef.current;
    const saved = savedRef.current;
    if (next.strokes !== saved.strokes || next.putts !== saved.putts) {
      savedRef.current = next;
      onSubmitAction(next);
    }
    onOpenChangeAction(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChangeAction(true);
      return;
    }
    commitAndClose();
  };

  const advanceFromStrokes = () => {
    setShowMore(false);
    if (showPutts) {
      setStep("putts");
      return;
    }
    if (showGreenie) {
      setStep("greenie");
      return;
    }
    commitAndClose();
  };

  const advanceFromPutts = () => {
    setShowMore(false);
    if (showGreenie) {
      setStep("greenie");
      return;
    }
    commitAndClose();
  };

  const handleStrokes = (value: number) => {
    applyDraft({ strokes: value, putts: draftRef.current.putts });
    advanceFromStrokes();
  };

  const handlePutts = (value: number) => {
    applyDraft({ strokes: draftRef.current.strokes, putts: value });
    advanceFromPutts();
  };

  const handleClear = () => {
    applyDraft({ strokes: null, putts: null });
    commitAndClose();
  };

  const greenieValue = parseGreenie(greenieDraft);

  const handleGreenieSave = () => {
    if (greenieValue) onGreenieSaveAction(greenieValue);
    commitAndClose();
  };

  const handleGreenieClear = () => {
    setGreenieDraft(EMPTY_GREENIE_DRAFT);
    if (greenie != null) onGreenieDeleteAction();
    commitAndClose();
  };

  const canClear = strokes != null || putts != null;
  // Strokes and putts tuck Clear behind More; the greenie step has no More, so
  // it shows Clear as soon as there is a distance to throw away.
  const showClear =
    step === "greenie"
      ? greenie != null || !isGreenieDraftEmpty(greenieDraft)
      : canClear && showMore;

  const handleClearAction = () => {
    if (step === "greenie") {
      handleGreenieClear();
      return;
    }
    handleClear();
  };
  const stepLabel =
    step === "strokes" ? "Strokes" : step === "putts" ? "Putts" : "Greenie";

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="gap-0 rounded-t-2xl px-5 pb-8 pt-5"
      >
        <SheetHeader className="flex-row items-baseline justify-between gap-3 p-0">
          <SheetTitle className="text-lg">Hole {hole}</SheetTitle>
          <span className="min-w-0 truncate font-heading text-lg font-medium text-foreground">
            {playerName}
          </span>
        </SheetHeader>

        <SheetDescription className="mt-5 text-xs font-medium uppercase tracking-wide">
          {stepLabel}
        </SheetDescription>

        <div className="mt-2 flex flex-col gap-3">
          {step === "strokes" ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                {strokeOptions(par, STROKE_OFFSETS).map((value) => (
                  <ChoiceButton
                    key={value}
                    value={value}
                    label={strokeLabel(value, par)}
                    selected={draft.strokes === value}
                    onSelectAction={handleStrokes}
                  />
                ))}
              </div>
              {showMore ? (
                <div className="grid grid-cols-3 gap-2">
                  {strokeOptions(par, EXTRA_STROKE_OFFSETS).map((value) => (
                    <ChoiceButton
                      key={value}
                      value={value}
                      label={strokeLabel(value, par)}
                      selected={draft.strokes === value}
                      onSelectAction={handleStrokes}
                    />
                  ))}
                </div>
              ) : null}
            </>
          ) : null}

          {step === "putts" ? (
            <>
              <div className="grid grid-cols-5 gap-2">
                {PUTT_OPTIONS.map((value) => (
                  <ChoiceButton
                    key={value}
                    value={value}
                    selected={draft.putts === value}
                    onSelectAction={handlePutts}
                  />
                ))}
              </div>
              {showMore ? (
                <div className="grid grid-cols-5 gap-2">
                  {EXTRA_PUTT_OPTIONS.map((value) => (
                    <ChoiceButton
                      key={value}
                      value={value}
                      selected={draft.putts === value}
                      onSelectAction={handlePutts}
                    />
                  ))}
                </div>
              ) : null}
            </>
          ) : null}

          {step === "greenie" ? (
            <GreenieInputs
              hole={hole}
              idPrefix={`sheet-hole-${hole}`}
              draft={greenieDraft}
              onChangeAction={setGreenieDraft}
            />
          ) : null}
        </div>

        <div className="mt-4 flex items-center gap-2">
          {showClear ? (
            <Button
              type="button"
              variant="destructive"
              size="xl"
              onClick={handleClearAction}
            >
              Clear
            </Button>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            {step !== "greenie" && !showMore ? (
              <Button
                type="button"
                variant="ghost"
                size="xl"
                onClick={() => setShowMore(true)}
              >
                More
              </Button>
            ) : null}
            {step === "greenie" ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="xl"
                  onClick={commitAndClose}
                >
                  Skip
                </Button>
                <Button
                  type="button"
                  size="xl"
                  disabled={greenieValue == null}
                  onClick={handleGreenieSave}
                >
                  Save
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
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
      variant={selected ? "default" : "outline"}
      className={cn(
        "flex flex-col items-center justify-center gap-1 px-0",
        label ? "h-20" : "h-16"
      )}
      onClick={() => onSelectAction(value)}
    >
      <span className="text-2xl font-semibold tabular-nums leading-none">
        {value}
      </span>
      {label ? (
        <span className="text-sm font-normal leading-none opacity-80">
          {label}
        </span>
      ) : null}
    </Button>
  );
}
