"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { HugeiconsIcon } from "@hugeicons/react";
import { Mic02Icon, MicOff02Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  type BrowserSpeechRecognition,
  getSpeechRecognitionConstructor,
  parseScoreDictation,
} from "./score-dictation";

const SAVE_DEBOUNCE_MS = 400;

export type HoleScorePatch = {
  strokes: number | null;
  putts: number | null;
};

type ScoreOption = {
  label: string;
  value: number;
};

type DictationStatus = "idle" | "listening" | "unsupported" | "error";

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
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const [dictationStatus, setDictationStatus] = useState<DictationStatus>(() =>
    getSpeechRecognitionConstructor() ? "idle" : "unsupported",
  );
  const [dictationMessage, setDictationMessage] = useState<string | null>(null);

  const strokeOptions = useMemo<ScoreOption[]>(
    () =>
      [
        { label: "Birdie", value: par - 1 },
        { label: "Par", value: par },
        { label: "Bogey", value: par + 1 },
      ].filter((option) => option.value >= 1),
    [par],
  );
  const puttOptions = [
    { label: "One", value: 1 },
    { label: "Two", value: 2 },
    { label: "Three", value: 3 },
  ];

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

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const applyDictatedScore = useCallback(
    (patch: HoleScorePatch) => {
      const nextStrokes = patch.strokes ?? currentStrokes;
      const nextPutts = patch.putts ?? currentPutts;

      setStrokesStr(toInputValue(nextStrokes));
      setPuttsStr(toInputValue(nextPutts));
      flushSave({ strokes: nextStrokes, putts: nextPutts });

      if (nextStrokes != null && nextPutts != null) {
        onAdvanceHoleAction();
      }
    },
    [currentPutts, currentStrokes, flushSave, onAdvanceHoleAction],
  );

  const handleDictationClick = () => {
    if (dictationStatus === "listening") {
      recognitionRef.current?.stop();
      setDictationStatus("idle");
      return;
    }

    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setDictationStatus("unsupported");
      setDictationMessage("Speech input is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length })
        .map((_, resultIndex) => event.results.item(resultIndex).item(0))
        .map((result) => result.transcript)
        .join(" ");
      const patch = parseScoreDictation(transcript, par);

      if (!patch) {
        setDictationMessage("Could not read a score from that.");
        return;
      }

      setDictationMessage(null);
      applyDictatedScore(patch);
    };
    recognition.onerror = (event) => {
      setDictationMessage(
        event.error === "not-allowed"
          ? "Microphone access was blocked."
          : "Speech input failed. Try again.",
      );
      setDictationStatus("error");
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setDictationStatus((status) =>
        status === "listening" ? "idle" : status,
      );
    };

    setDictationMessage(null);
    setDictationStatus("listening");
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setDictationStatus("error");
      setDictationMessage("Speech input failed. Try again.");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant={dictationStatus === "listening" ? "default" : "outline"}
          size="sm"
          disabled={dictationStatus === "unsupported"}
          onClick={handleDictationClick}
          aria-label={
            dictationStatus === "listening"
              ? "Stop score dictation"
              : "Dictate score"
          }
          title='Try "five strokes, two putts" or "par, two putts"'
        >
          <HugeiconsIcon
            icon={
              dictationStatus === "unsupported" ? MicOff02Icon : Mic02Icon
            }
            data-icon="inline-start"
          />
          {dictationStatus === "listening" ? "Listening" : "Dictate"}
        </Button>
      </div>
      {dictationMessage ? (
        <p
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            dictationStatus === "error" || dictationStatus === "unsupported"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-border bg-muted text-muted-foreground",
          )}
          role="status"
          aria-live="polite"
        >
          {dictationMessage}
        </p>
      ) : null}
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
}: ScoreFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="grid grid-cols-4 gap-2">
        <div className="flex flex-col items-center justify-between gap-2">
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={min}
            step={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            className="h-12 text-center tabular-nums"
            placeholder="0"
          />
        </div>

        {options.map((option) => (
          <Button
            key={option.label}
            type="button"
            variant={activeChip === option.value ? "default" : "secondary"}
            className="h-12 tabular-nums"
            onClick={() => onChipClick(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
