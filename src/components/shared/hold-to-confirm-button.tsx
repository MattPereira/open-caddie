"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type HoldToConfirmButtonProps = {
  onConfirmAction: () => void;
  durationMs?: number;
  disabled?: boolean;
  idleLabel: ReactNode;
  holdingLabel?: ReactNode;
};

export function HoldToConfirmButton({
  onConfirmAction,
  durationMs = 2000,
  disabled,
  idleLabel,
  holdingLabel = "Keep holding…",
}: HoldToConfirmButtonProps) {
  const [holding, setHolding] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const cancel = () => {
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setHolding(false);
  };

  useEffect(() => () => cancel(), []);

  const start = () => {
    if (disabled) return;
    setHolding(true);
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      setHolding(false);
      onConfirmAction();
    }, durationMs);
  };

  return (
    <Button
      type="button"
      variant="destructive"
      size="xl"
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      className="relative overflow-hidden touch-none select-none"
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 bg-white/25",
          holding ? "ease-linear" : "ease-out",
        )}
        style={{
          width: holding ? "100%" : "0%",
          transitionProperty: "width",
          transitionDuration: holding ? `${durationMs}ms` : "150ms",
        }}
      />
      <span className="relative">{holding ? holdingLabel : idleLabel}</span>
    </Button>
  );
}
