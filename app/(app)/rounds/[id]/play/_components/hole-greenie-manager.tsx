"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type GreenieValue = { feet: number; inches: number };

const SAVE_DEBOUNCE_MS = 400;

type HoleGreenieManagerProps = {
  hole: number;
  initialGreenie: GreenieValue | null;
  onSaveAction: (value: GreenieValue) => void;
  onDeleteAction: () => void;
};

type Mode = "empty" | "editing" | "saved";

function toInputValue(value: number | null): string {
  return value == null ? "" : String(value);
}

function parseFeet(value: string): number | null {
  if (value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function parseInches(value: string): number | null {
  if (value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 11 ? n : null;
}

export function HoleGreenieManager({
  hole,
  initialGreenie,
  onSaveAction,
  onDeleteAction,
}: HoleGreenieManagerProps) {
  const [mode, setMode] = useState<Mode>(initialGreenie ? "saved" : "empty");
  const [feetStr, setFeetStr] = useState(
    toInputValue(initialGreenie?.feet ?? null),
  );
  const [inchesStr, setInchesStr] = useState(
    toInputValue(initialGreenie?.inches ?? null),
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingValueRef = useRef<GreenieValue | null>(null);
  const onSaveRef = useRef(onSaveAction);
  const lastSavedRef = useRef<GreenieValue | null>(initialGreenie);

  useEffect(() => {
    onSaveRef.current = onSaveAction;
  }, [onSaveAction]);

  const flushSave = useCallback((value: GreenieValue) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    pendingValueRef.current = null;
    if (
      lastSavedRef.current?.feet === value.feet &&
      lastSavedRef.current.inches === value.inches
    ) {
      setMode("saved");
      return;
    }
    lastSavedRef.current = value;
    setMode("saved");
    onSaveRef.current(value);
  }, []);

  const scheduleSave = (value: GreenieValue | null) => {
    pendingValueRef.current = value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value) return;
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      const pendingValue = pendingValueRef.current;
      if (pendingValue) flushSave(pendingValue);
    }, SAVE_DEBOUNCE_MS);
  };

  useEffect(() => {
    return () => {
      const pendingValue = pendingValueRef.current;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (pendingValue) flushSave(pendingValue);
    };
  }, [flushSave]);

  const saveIfComplete = (nextFeetStr: string, nextInchesStr: string) => {
    const feet = parseFeet(nextFeetStr);
    const inches = parseInches(nextInchesStr);
    scheduleSave(feet == null || inches == null ? null : { feet, inches });
  };

  const handleFeetChange = (value: string) => {
    setFeetStr(value);
    setMode("editing");
    saveIfComplete(value, inchesStr);
  };

  const handleInchesChange = (value: string) => {
    setInchesStr(value);
    setMode("editing");
    saveIfComplete(feetStr, value);
  };

  const handleBlur = () => {
    const pendingValue = pendingValueRef.current;
    if (pendingValue) flushSave(pendingValue);
  };

  const handleDelete = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    pendingValueRef.current = null;
    lastSavedRef.current = null;
    setFeetStr("");
    setInchesStr("");
    setMode("empty");
    onDeleteAction();
  };

  if (mode === "empty") {
    return (
      <Button
        type="button"
        variant="secondary"
        size="xl"
        onClick={() => setMode("editing")}
        className="mt-8"
      >
        Add Greenie
      </Button>
    );
  }

  const feetId = `hole-${hole}-greenie-feet`;
  const inchesId = `hole-${hole}-greenie-inches`;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={feetId}>Greenie</Label>
      <div className="flex gap-3 items-end">
        <Input
          id={feetId}
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          placeholder="Feet"
          value={feetStr}
          onChange={(e) => handleFeetChange(e.target.value)}
          onBlur={handleBlur}
          className="h-12 flex-1 text-center tabular-nums"
        />
        <Input
          id={inchesId}
          type="number"
          inputMode="numeric"
          min={0}
          max={11}
          step={1}
          placeholder="Inches"
          value={inchesStr}
          onChange={(e) => handleInchesChange(e.target.value)}
          onBlur={handleBlur}
          className="h-12 flex-1 text-center tabular-nums"
        />
      </div>
      <Button
        type="button"
        variant="link"
        size="sm"
        onClick={() => handleDelete()}
        className="ml-auto h-auto p-0 text-xs font-normal text-muted-foreground"
      >
        Remove
      </Button>
    </div>
  );
}
