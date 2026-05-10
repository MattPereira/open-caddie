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

type ScoreOption = {
  label: string;
  value: number;
};

type HoleScoreSlideProps = {
  hole: number;
  par: number;
  initialStrokes: number | null;
  initialPutts: number | null;
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
  onScoreChangeAction,
  onAdvanceHoleAction,
}: HoleScoreSlideProps) {
  const [strokesStr, setStrokesStr] = useState(toInputValue(initialStrokes));
  const [puttsStr, setPuttsStr] = useState(toInputValue(initialPutts));

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatchRef = useRef<HoleScorePatch | null>(null);
  const onScoreChangeRef = useRef(onScoreChangeAction);
  const lastSavedRef = useRef<{ strokes: number | null; putts: number | null }>(
    { strokes: initialStrokes, putts: initialPutts },
  );
  const puttsDirtyRef = useRef(false);

  const strokeOptions = useMemo<ScoreOption[]>(
    () =>
      [
        { label: "Birdie", value: par - 1 },
        { label: "Par", value: par },
        { label: "Bogey", value: par + 1 },
        { label: "Double", value: par + 2 },
      ].filter((option) => option.value >= 1),
    [par],
  );
  const puttOptions = [0, 1, 2, 3].map((value) => ({
    label: String(value),
    value,
  }));

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
    <div className="grid grid-cols-2 gap-5">
      <ScoreField
        id={`hole-${hole}-strokes`}
        label="Strokes"
        value={strokesStr}
        onChange={handleStrokesChange}
        onBlur={handleStrokesBlur}
        options={strokeOptions}
        activeChip={currentStrokes}
        onChipClick={handleStrokesChip}
        min={1}
        optionColumns={2}
      />
      <ScoreField
        id={`hole-${hole}-putts`}
        label="Putts"
        value={puttsStr}
        onChange={handlePuttsChange}
        onBlur={handlePuttsBlur}
        options={puttOptions}
        activeChip={currentPutts}
        onChipClick={handlePuttsChip}
        min={0}
        optionColumns={2}
      />
    </div>
  );
}

type ScoreFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  options: ScoreOption[];
  activeChip: number | null;
  onChipClick: (n: number) => void;
  min: number;
  optionColumns?: 1 | 2;
};

function ScoreField({
  id,
  label,
  value,
  onChange,
  onBlur,
  options,
  activeChip,
  onChipClick,
  min,
  optionColumns = 1,
}: ScoreFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="h-11 text-center text-lg tabular-nums"
      />
      <div
        className={cn(
          "grid gap-2",
          optionColumns === 2 ? "grid-cols-2" : "grid-cols-1",
        )}
      >
        {options.map((option) => (
          <Button
            key={option.label}
            type="button"
            variant={activeChip === option.value ? "default" : "secondary"}
            className={cn("h-10 text-base tabular-nums")}
            onClick={() => onChipClick(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
