"use client";

import { useState } from "react";
import { Edit03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import { RoundScoresSheet, type EditableRound } from "./round-scores-sheet";

export function RoundActions({ round }: { round: EditableRound }) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setSheetOpen(true)}>
        <HugeiconsIcon icon={Edit03Icon} data-icon="inline-start" />
        Edit
      </Button>
      <RoundScoresSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        round={round}
      />
    </>
  );
}
