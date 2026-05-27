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
  idPrefix: string;
  playerName: string;
  initialStrokes: number | null;
  initialPutts: number | null;
  showPutts?: boolean;
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
  idPrefix,
  playerName,
  initialStrokes,
  initialPutts,
  showPutts = true,
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

  const handleBlur = () => {
    const pendingPatch = pendingPatchRef.current;
    if (pendingPatch) flushSave(pendingPatch);
  };

  const handleDictatedScore = (patch: HoleScorePatch) => {
    const nextStrokes = patch.strokes ?? currentStrokes;
    const nextPutts = patch.putts ?? currentPutts;

    setStrokesStr(toInputValue(nextStrokes));
    setPuttsStr(toInputValue(nextPutts));
    flushSave({ strokes: nextStrokes, putts: nextPutts });
  };

  const strokesId = `${idPrefix}-hole-${hole}-strokes`;
  const puttsId = `${idPrefix}-hole-${hole}-putts`;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={strokesId}>{playerName} scores</Label>
      <div
        className={
          showPutts
            ? "grid grid-cols-[1fr_1fr_auto] items-center gap-4"
            : "grid grid-cols-[1fr_auto] items-center gap-4"
        }
      >
        <ScoreField
          id={strokesId}
          placeholder="Strokes"
          value={strokesStr}
          onChange={handleStrokesChange}
          onBlur={handleBlur}
          min={1}
        />
        {showPutts && (
          <ScoreField
            id={puttsId}
            placeholder="Putts"
            value={puttsStr}
            onChange={handlePuttsChange}
            onBlur={handleBlur}
            min={0}
          />
        )}
        <ScoreDictationButton
          par={par}
          ariaLabel={`Dictate ${playerName} score`}
          onDictatedScoreAction={handleDictatedScore}
        />
      </div>
    </div>
  );
}

type ScoreFieldProps = {
  id: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  min: number;
};

function ScoreField({
  id,
  placeholder,
  value,
  onChange,
  onBlur,
  min,
}: ScoreFieldProps) {
  return (
    <Input
      id={id}
      type="number"
      inputMode="numeric"
      min={min}
      step={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className="h-12 text-center text-lg tabular-nums"
      placeholder={placeholder}
    />
  );
}
