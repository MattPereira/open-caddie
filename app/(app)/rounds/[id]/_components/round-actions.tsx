"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import {
  RoundScoresSheet,
  type EditableRound,
  type RoundScoresTab,
} from "./round-scores-sheet";

export function RoundActions({
  initialTab = "front",
  round,
}: {
  initialTab?: RoundScoresTab;
  round: EditableRound;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button size="sm" onClick={() => setSheetOpen(true)}>
        <HugeiconsIcon icon={Edit03Icon} data-icon="inline-start" />
        Edit
      </Button>
      {sheetOpen ? (
        <RoundScoresSheet
          initialTab={initialTab}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onDeleted={() => {
            router.push(`/players/${round.userId}`);
            router.refresh();
          }}
          round={round}
        />
      ) : null}
    </>
  );
}
