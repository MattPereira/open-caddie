"use client";

import { Input } from "@/components/ui/input";

export type GreenieValue = { feet: number; inches: number };
export type GreenieDraft = { feet: string; inches: string };

export const EMPTY_GREENIE_DRAFT: GreenieDraft = { feet: "", inches: "" };

export function toGreenieDraft(value: GreenieValue | null): GreenieDraft {
  return value == null
    ? EMPTY_GREENIE_DRAFT
    : { feet: String(value.feet), inches: String(value.inches) };
}

export function isGreenieDraftEmpty(draft: GreenieDraft) {
  return draft.feet === "" && draft.inches === "";
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

export function parseGreenie(draft: GreenieDraft): GreenieValue | null {
  const feet = parseFeet(draft.feet);
  const inches = parseInches(draft.inches);
  if (feet == null || inches == null) return null;
  return { feet, inches };
}

type GreenieInputsProps = {
  hole: number;
  idPrefix: string;
  draft: GreenieDraft;
  onChangeAction: (draft: GreenieDraft) => void;
};

export function GreenieInputs({
  hole,
  idPrefix,
  draft,
  onChangeAction,
}: GreenieInputsProps) {
  const feetId = `${idPrefix}-hole-${hole}-greenie-feet`;
  const inchesId = `${idPrefix}-hole-${hole}-greenie-inches`;
  return (
    <div className="flex items-end gap-3">
      <Input
        id={feetId}
        aria-label="Feet"
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        placeholder="Feet"
        value={draft.feet}
        onChange={(e) => onChangeAction({ ...draft, feet: e.target.value })}
        className="h-12 flex-1 text-center tabular-nums"
      />
      <Input
        id={inchesId}
        aria-label="Inches"
        type="number"
        inputMode="numeric"
        min={0}
        max={11}
        step={1}
        placeholder="Inches"
        value={draft.inches}
        onChange={(e) => onChangeAction({ ...draft, inches: e.target.value })}
        className="h-12 flex-1 text-center tabular-nums"
      />
    </div>
  );
}
