"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { deleteRound } from "../actions";

type RoundSummary = {
  courseName: string;
  date: Date | string;
  tournamentLabel: string | null;
};

type RoundScoringPlaceholderProps = {
  roundId: number;
  summary: RoundSummary;
  onBackToHome: () => void;
  onAbandoned: () => void;
};

export function RoundScoringPlaceholder({
  roundId,
  summary,
  onBackToHome,
  onAbandoned,
}: RoundScoringPlaceholderProps) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAbandon = () => {
    setError(null);
    startTransition(async () => {
      const result = await deleteRound(roundId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onAbandoned();
    });
  };

  return (
    <div className="flex w-full flex-col gap-6 rounded-lg border border-border p-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">Round in progress</p>
        <h2 className="text-lg font-medium">{summary.courseName}</h2>
        <p className="text-sm text-muted-foreground">
          {formatDate(summary.date, "long")}
          {summary.tournamentLabel ? ` · ${summary.tournamentLabel}` : ""}
        </p>
      </div>

      <p className="text-sm text-muted-foreground">
        Hole-by-hole score entry coming soon. Round id: {roundId}.
      </p>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {confirming ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">
            Are you sure? This permanently deletes this round.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={handleAbandon}
            >
              {isPending ? "Deleting…" : "Yes, abandon"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="destructive"
            onClick={() => setConfirming(true)}
          >
            Abandon round
          </Button>
          <Button type="button" variant="outline" onClick={onBackToHome}>
            Back to home
          </Button>
        </div>
      )}
    </div>
  );
}
