"use client";

import { useEffect, useState } from "react";

import { Spinner } from "@/components/ui/spinner";

type ParsingOverlayProps = {
  active: boolean;
  title: string;
  messages: string[];
};

/**
 * Full-screen blocking overlay shown while an AI parse runs. The messages are
 * purely cosmetic — they rotate to signal progress, not report it.
 */
export function ParsingOverlay({
  active,
  title,
  messages,
}: ParsingOverlayProps) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setMessageIndex((index) => (index + 1) % messages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [active, messages.length]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 px-6 backdrop-blur-sm">
      <div className="flex w-full max-w-xs animate-in fade-in zoom-in-95 flex-col items-center gap-4 rounded-2xl border bg-card p-8 text-center shadow-lg">
        <Spinner className="size-10 text-primary" />
        <div className="flex flex-col gap-1">
          <p className="font-semibold">{title}</p>
          <p
            key={messages[messageIndex]}
            className="animate-in fade-in text-sm text-muted-foreground"
            aria-live="polite"
          >
            {messages[messageIndex]}
          </p>
        </div>
      </div>
    </div>
  );
}
