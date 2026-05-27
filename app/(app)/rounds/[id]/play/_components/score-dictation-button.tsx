"use client";

import { useEffect, useRef, useState } from "react";

import { Mic02Icon, MicOff02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type BrowserSpeechRecognition,
  type ScoreDictationPatch,
  getSpeechRecognitionConstructor,
  parseScoreDictation,
} from "./score-dictation";

type DictationStatus = "idle" | "listening" | "unsupported" | "blocked";

type ScoreDictationButtonProps = {
  par: number;
  ariaLabel?: string;
  onDictatedScoreAction: (patch: ScoreDictationPatch) => void;
};

export function ScoreDictationButton({
  par,
  ariaLabel = "Dictate score",
  onDictatedScoreAction,
}: ScoreDictationButtonProps) {
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const [status, setStatus] = useState<DictationStatus>("idle");

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const handleClick = () => {
    if (status === "listening") {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setStatus("unsupported");
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
        .join(" ")
        .trim();

      const patch = parseScoreDictation(transcript, par);
      if (patch) onDictatedScoreAction(patch);
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed") setStatus("blocked");
      else setStatus("idle");
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setStatus((prev) => (prev === "listening" ? "idle" : prev));
    };

    setStatus("listening");
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setStatus("idle");
    }
  };

  const isUnsupported = status === "unsupported" || status === "blocked";

  return (
    <Button
      type="button"
      size="icon-xl"
      variant="default"
      className={cn(
        "h-12 w-14",
        status === "listening" &&
          "bg-blue-600 text-white shadow-sm ring-2 ring-blue-200 hover:bg-blue-600 focus-visible:ring-blue-300",
      )}
      disabled={isUnsupported}
      onClick={handleClick}
      aria-label={status === "listening" ? "Stop score dictation" : ariaLabel}
    >
      <HugeiconsIcon icon={isUnsupported ? MicOff02Icon : Mic02Icon} />
    </Button>
  );
}
