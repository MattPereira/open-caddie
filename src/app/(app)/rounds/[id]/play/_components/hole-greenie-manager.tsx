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
    <div className="flex items-end gap-2">
      <GreenieField
        id={feetId}
        label="Feet"
        value={draft.feet}
        onChangeAction={(feet) => onChangeAction({ ...draft, feet })}
      />
      <GreenieField
        id={inchesId}
        label="Inches"
        max={11}
        value={draft.inches}
        onChangeAction={(inches) => onChangeAction({ ...draft, inches })}
      />
    </div>
  );
}

// Once a value is typed the placeholder is gone, so the unit moves to the
// corner to keep saying what the number means.
function GreenieField({
  id,
  label,
  max,
  value,
  onChangeAction,
}: {
  id: string;
  label: string;
  max?: number;
  value: string;
  onChangeAction: (value: string) => void;
}) {
  const showUnit = value !== "";
  return (
    <div className="relative flex-1">
      <Input
        id={id}
        aria-label={label}
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        step={1}
        placeholder={label}
        value={value}
        onChange={(e) => onChangeAction(e.target.value)}
        className="h-16 w-full text-center text-2xl font-semibold tabular-nums placeholder:text-base placeholder:font-normal md:text-2xl"
      />
      {showUnit ? (
        <span
          aria-hidden
          className="pointer-events-none absolute top-1.5 right-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}
