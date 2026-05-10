"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const SAVE_DEBOUNCE_MS = 400;

export type HoleScorePatch = {
  strokes: number | null;
  putts: number | null;
};

type HoleScoreSlideProps = {
  hole: number;
  par: number;
  initialStrokes: number | null;
  initialPutts: number | null;
  isActive: boolean;
  onScoreChangeAction: (patch: HoleScorePatch) => void;
  onAdvanceHoleAction: () => void;
};

function toInputValue(value: number | null): string {
  return value == null ? "" : String(value);
}

function parseStrokes(value: string): number | null {
  if (value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

function parsePutts(value: string): number | null {
  if (value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export function HoleScoreSlide({
  hole,
  par,
  initialStrokes,
  initialPutts,
  isActive,
  onScoreChangeAction,
  onAdvanceHoleAction,
}: HoleScoreSlideProps) {
  const [strokesStr, setStrokesStr] = useState(toInputValue(initialStrokes));
  const [puttsStr, setPuttsStr] = useState(toInputValue(initialPutts));

  const strokesRef = useRef<HTMLInputElement>(null);
  const puttsRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatchRef = useRef<HoleScorePatch | null>(null);
  const onScoreChangeRef = useRef(onScoreChangeAction);
  const lastSavedRef = useRef<{ strokes: number | null; putts: number | null }>(
    { strokes: initialStrokes, putts: initialPutts },
  );
  const puttsDirtyRef = useRef(false);

  const strokeChips = useMemo(
    () => [par - 1, par, par + 1].filter((n) => n >= 1),
    [par],
  );
  const puttChips = [1, 2, 3];

  useEffect(() => {
    onScoreChangeRef.current = onScoreChangeAction;
  }, [onScoreChangeAction]);

  const flushSave = useCallback((patch: HoleScorePatch) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    pendingPatchRef.current = null;
    if (
      patch.strokes === lastSavedRef.current.strokes &&
      patch.putts === lastSavedRef.current.putts
    ) {
      return;
    }
    lastSavedRef.current = patch;
    onScoreChangeRef.current(patch);
  }, []);

  const scheduleSave = (patch: HoleScorePatch) => {
    pendingPatchRef.current = patch;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      const pendingPatch = pendingPatchRef.current;
      if (pendingPatch) flushSave(pendingPatch);
    }, SAVE_DEBOUNCE_MS);
  };

  useEffect(() => {
    return () => {
      const pendingPatch = pendingPatchRef.current;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (pendingPatch) flushSave(pendingPatch);
    };
  }, [flushSave]);

  useEffect(() => {
    if (!isActive) return;
    const target = strokesStr === "" ? strokesRef.current : puttsRef.current;
    target?.focus({ preventScroll: true });
  }, [isActive, strokesStr]);

  const currentStrokes = parseStrokes(strokesStr);
  const currentPutts = parsePutts(puttsStr);

  const handleStrokesChange = (value: string) => {
    setStrokesStr(value);
    scheduleSave({ strokes: parseStrokes(value), putts: currentPutts });
  };

  const handlePuttsChange = (value: string) => {
    setPuttsStr(value);
    puttsDirtyRef.current = true;
    scheduleSave({ strokes: currentStrokes, putts: parsePutts(value) });
  };

  const handleStrokesChip = (n: number) => {
    setStrokesStr(String(n));
    flushSave({ strokes: n, putts: currentPutts });
    if (currentPutts != null) {
      onAdvanceHoleAction();
    } else {
      puttsRef.current?.focus({ preventScroll: true });
    }
  };

  const handleStrokesBlur = () => {
    const pendingPatch = pendingPatchRef.current;
    if (pendingPatch) flushSave(pendingPatch);
  };

  const handlePuttsChip = (n: number) => {
    setPuttsStr(String(n));
    flushSave({ strokes: currentStrokes, putts: n });
    if (currentStrokes != null) {
      onAdvanceHoleAction();
    }
  };

  const handlePuttsBlur = () => {
    const pendingPatch = pendingPatchRef.current;
    if (pendingPatch) flushSave(pendingPatch);
    const wasDirty = puttsDirtyRef.current;
    puttsDirtyRef.current = false;
    const strokes = pendingPatch?.strokes ?? currentStrokes;
    const putts = pendingPatch?.putts ?? currentPutts;
    if (wasDirty && putts != null && strokes != null) {
      onAdvanceHoleAction();
    }
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <ScoreField
          id={`hole-${hole}-strokes`}
          label="Strokes"
          inputRef={strokesRef}
          value={strokesStr}
          onChange={handleStrokesChange}
          onBlur={handleStrokesBlur}
          chips={strokeChips}
          activeChip={currentStrokes}
          onChipClick={handleStrokesChip}
          min={1}
        />
        <ScoreField
          id={`hole-${hole}-putts`}
          label="Putts"
          inputRef={puttsRef}
          value={puttsStr}
          onChange={handlePuttsChange}
          onBlur={handlePuttsBlur}
          chips={puttChips}
          activeChip={currentPutts}
          onChipClick={handlePuttsChip}
          min={0}
        />
      </div>
    </div>
  );
}

type ScoreFieldProps = {
  id: string;
  label: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  chips: number[];
  activeChip: number | null;
  onChipClick: (n: number) => void;
  min: number;
};

function ScoreField({
  id,
  label,
  inputRef,
  value,
  onChange,
  onBlur,
  chips,
  activeChip,
  onChipClick,
  min,
}: ScoreFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        ref={inputRef}
        type="number"
        inputMode="numeric"
        min={min}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="h-11 text-center text-lg tabular-nums"
      />
      <div className="flex flex-col gap-2">
        {chips.map((n) => (
          <Button
            key={n}
            type="button"
            variant={activeChip === n ? "default" : "secondary"}
            className={cn("h-10 text-base tabular-nums")}
            onClick={() => onChipClick(n)}
          >
            {n}
          </Button>
        ))}
      </div>
    </div>
  );
}
