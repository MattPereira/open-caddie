"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { HoleGreenieManager, type GreenieValue } from "./hole-greenie-manager";

export type ScorePatch = { strokes: number | null; putts: number | null };

type Step = "strokes" | "putts" | "greenie";

const STROKE_OFFSETS = [-2, -1, 0, 1, 2, 3];
const EXTRA_STROKE_OFFSETS = [4, 5, 6, 7, 8, 9];
const PUTT_OPTIONS = [0, 1, 2, 3, 4];
const EXTRA_PUTT_OPTIONS = [5, 6, 7, 8, 9, 10];

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

  const canClear = strokes != null || putts != null;
  const stepLabel =
    step === "strokes" ? "Strokes" : step === "putts" ? "Putts" : "Greenie";

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="gap-0 rounded-t-2xl px-5 pb-8 pt-5"
      >
        <SheetHeader className="p-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <SheetTitle className="text-lg">
                Hole {hole} · Par {par}
              </SheetTitle>
              <SheetDescription>
                {playerName} · {stepLabel}
              </SheetDescription>
            </div>
            {canClear ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
              >
                Clear
              </Button>
            ) : null}
          </div>
        </SheetHeader>

        <div className="mt-5 flex flex-col gap-3">
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
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="xl"
                  onClick={() => setShowMore(true)}
                >
                  More
                </Button>
              )}
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
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="xl"
                  onClick={() => setShowMore(true)}
                >
                  More
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="xl"
                onClick={advanceFromPutts}
              >
                Skip putts
              </Button>
            </>
          ) : null}

          {step === "greenie" ? (
            <div className="flex flex-col gap-4">
              <HoleGreenieManager
                key={`${playerName}-${hole}`}
                hole={hole}
                idPrefix={`sheet-hole-${hole}`}
                playerName={playerName}
                initialGreenie={greenie}
                onSaveAction={onGreenieSaveAction}
                onDeleteAction={onGreenieDeleteAction}
              />
              <Button type="button" size="xl" onClick={commitAndClose}>
                Done
              </Button>
            </div>
          ) : null}
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
      className="flex h-16 flex-col items-center justify-center gap-0.5 px-0"
      onClick={() => onSelectAction(value)}
    >
      <span className="text-2xl font-semibold tabular-nums leading-none">
        {value}
      </span>
      {label ? (
        <span className="text-[0.7rem] font-normal opacity-80">{label}</span>
      ) : null}
    </Button>
  );
}
