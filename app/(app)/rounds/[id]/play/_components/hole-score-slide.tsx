"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScoreDictationButton } from "./score-dictation-button";

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
  onScoreChangeAction: (patch: HoleScorePatch) => void;
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
}: HoleScoreSlideProps) {
  const [strokesStr, setStrokesStr] = useState(toInputValue(initialStrokes));
  const [puttsStr, setPuttsStr] = useState(toInputValue(initialPutts));

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatchRef = useRef<HoleScorePatch | null>(null);
  const onScoreChangeRef = useRef(onScoreChangeAction);
  const lastSavedRef = useRef<{ strokes: number | null; putts: number | null }>(
    { strokes: initialStrokes, putts: initialPutts },
  );

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
    scheduleSave({ strokes: currentStrokes, putts: parsePutts(value) });
  };

  const handleStrokesBlur = () => {
    const pendingPatch = pendingPatchRef.current;
    if (pendingPatch) flushSave(pendingPatch);
  };

  const handlePuttsBlur = () => {
    const pendingPatch = pendingPatchRef.current;
    if (pendingPatch) flushSave(pendingPatch);
  };

  const applyDictatedScore = useCallback(
    (patch: HoleScorePatch) => {
      const nextStrokes = patch.strokes ?? currentStrokes;
      const nextPutts = patch.putts ?? currentPutts;

      setStrokesStr(toInputValue(nextStrokes));
      setPuttsStr(toInputValue(nextPutts));
      flushSave({ strokes: nextStrokes, putts: nextPutts });
    },
    [currentPutts, currentStrokes, flushSave],
  );

  return (
    <div className="flex flex-col gap-5">
      <ScoreDictationButton
        par={par}
        onDictatedScoreAction={applyDictatedScore}
      />
      <div className="grid grid-cols-2 gap-3">
        <ScoreField
          id={`hole-${hole}-strokes`}
          label="Strokes"
          value={strokesStr}
          onChange={handleStrokesChange}
          onBlur={handleStrokesBlur}
          min={1}
        />
        <ScoreField
          id={`hole-${hole}-putts`}
          label="Putts"
          value={puttsStr}
          onChange={handlePuttsChange}
          onBlur={handlePuttsBlur}
          min={0}
        />
      </div>
    </div>
  );
}

type ScoreFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  min: number;
};

function ScoreField({
  id,
  label,
  value,
  onChange,
  onBlur,
  min,
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
        className="h-14 text-center text-lg tabular-nums"
        placeholder="0"
      />
    </div>
  );
}
