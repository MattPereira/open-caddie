"use client";

import { useState } from "react";
import { Edit03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  RoundScoresCard,
  toRoundScoreRow,
  type RoundScoresTableRound,
} from "@/components/round-scores-card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  RoundScoresSheet,
  type EditableRound,
} from "../rounds/[id]/_components/round-scores-sheet";
import type { RoundScoresUpdateValues } from "../schema";

export function RoundSummary({
  onScoresSaved,
  round,
  showEdit = false,
  showMobileTotals = true,
}: {
  onScoresSaved?: (values: RoundScoresUpdateValues) => void;
  round: RoundScoresTableRound;
  showEdit?: boolean;
  showMobileTotals?: boolean;
}) {
  const editableRound = toEditableRound(round);

  return (
    <RoundScoresCard
      action={
        showEdit && editableRound ? (
          <RoundSummaryEditAction
            onScoresSaved={onScoresSaved}
            round={editableRound}
          />
        ) : null
      }
      row={toRoundScoreRow(round)}
      showMobileTotals={showMobileTotals}
    />
  );
}

function RoundSummaryEditAction({
  onScoresSaved,
  round,
}: {
  onScoresSaved?: (values: RoundScoresUpdateValues) => void;
  round: EditableRound;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              onClick={() => setSheetOpen(true)}
              aria-label="Edit round"
            >
              <HugeiconsIcon icon={Edit03Icon} aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit round</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {sheetOpen ? (
        <RoundScoresSheet
          onSaved={onScoresSaved}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          round={round}
        />
      ) : null}
    </>
  );
}

function toEditableRound(round: RoundScoresTableRound): EditableRound | null {
  if (!round.userId || !round.holes || !round.greenies) {
    return null;
  }

  return {
    id: round.id,
    userId: round.userId,
    holes: round.holes,
    scores: round.scores,
    greenies: round.greenies,
  };
}
