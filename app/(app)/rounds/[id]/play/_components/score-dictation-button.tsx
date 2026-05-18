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

type DictationStatus =
  | "idle"
  | "listening"
  | "success"
  | "unsupported"
  | "blocked"
  | "error";

type ScoreDictationButtonProps = {
  par: number;
  onDictatedScoreAction: (patch: ScoreDictationPatch) => void;
};

export function ScoreDictationButton({
  par,
  onDictatedScoreAction,
}: ScoreDictationButtonProps) {
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const didParseScoreRef = useRef(false);
  const didManuallyStopRef = useRef(false);
  const statusRef = useRef<DictationStatus>("idle");
  const [status, setStatus] = useState<DictationStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const helperText =
    message ??
    {
      idle: 'Say "five, two" or "five strokes, two putts"',
      listening: "Listening stops automatically",
      success: "Score updated",
      unsupported: "Speech dictation is not supported in this browser",
      blocked: "Microphone access is blocked",
      error: 'Try again with "five, two"',
    }[status];

  function setDictationStatus(nextStatus: DictationStatus) {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  }

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const handleClick = () => {
    if (status === "listening") {
      didManuallyStopRef.current = true;
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setDictationStatus("unsupported");
      setMessage("Speech input is not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    didParseScoreRef.current = false;
    didManuallyStopRef.current = false;
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

      if (!patch) {
        setDictationStatus("error");
        setMessage(
          transcript
            ? `I heard "${transcript}" but couldn't read a score`
            : 'I didn\'t catch that. Try "five, two"',
        );
        return;
      }

      didParseScoreRef.current = true;
      setDictationStatus("success");
      setMessage(formatSavedScoreMessage(patch));
      onDictatedScoreAction(patch);
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        setDictationStatus("blocked");
        setMessage("Microphone access is blocked");
        return;
      }

      setDictationStatus("error");
      setMessage(
        event.error === "no-speech"
          ? 'I didn\'t catch that. Try "five, two"'
          : "Speech input failed. Try again",
      );
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      if (statusRef.current !== "listening") return;
      if (didParseScoreRef.current) {
        setDictationStatus("success");
      } else if (didManuallyStopRef.current) {
        setMessage("Stopped listening. Tap again when ready");
        setDictationStatus("idle");
      } else {
        setMessage('I didn\'t catch that. Try "five, two"');
        setDictationStatus("error");
      }
    };

    setMessage(null);
    setDictationStatus("listening");
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setDictationStatus("error");
      setMessage("Speech input failed. Try again");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        size="2xl"
        className={cn(
          "w-full",
          status === "listening" &&
            "bg-blue-600 text-white shadow-sm ring-2 ring-blue-200 hover:bg-blue-600 focus-visible:ring-blue-300",
        )}
        disabled={["unsupported", "blocked"].includes(status)}
        onClick={handleClick}
        aria-label={
          status === "listening" ? "Stop score dictation" : "Dictate score"
        }
        title='Try "five, two" or "five strokes, two putts"'
      >
        <HugeiconsIcon
          icon={status === "unsupported" ? MicOff02Icon : Mic02Icon}
          data-icon="inline-start"
        />
        <span>{status === "listening" ? "Listening" : "Dictate"}</span>
        {status === "listening" ? <ListeningWaveform /> : null}
      </Button>

      <p
        className={cn(
          "text-center text-base",
          ["error", "unsupported", "blocked"].includes(status) &&
            "text-destructive",
          status === "success" && "text-primary",
          !["error", "unsupported", "blocked", "success"].includes(status) &&
            "text-muted-foreground",
        )}
        role="status"
        aria-live="polite"
      >
        {helperText}
      </p>
    </div>
  );
}

function ListeningWaveform() {
  return (
    <span
      className="flex h-5 items-center gap-0.5"
      aria-hidden="true"
      data-icon="inline-end"
    >
      <span className="h-2 w-1 animate-pulse rounded-full bg-current/75 [animation-delay:-300ms]" />
      <span className="h-4 w-1 animate-pulse rounded-full bg-current/90 [animation-delay:-150ms]" />
      <span className="h-3 w-1 animate-pulse rounded-full bg-current/75" />
    </span>
  );
}

function formatSavedScoreMessage(patch: ScoreDictationPatch) {
  const parts = [
    patch.strokes == null
      ? null
      : `${patch.strokes} ${patch.strokes === 1 ? "stroke" : "strokes"}`,
    patch.putts == null
      ? null
      : `${patch.putts} ${patch.putts === 1 ? "putt" : "putts"}`,
  ].filter(Boolean);

  return `Saved ${parts.join(", ")}`;
}
