"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { ClubSheet } from "./club-sheet";

export function AddClubButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Add club"
        onClick={() => setOpen(true)}
      >
        <HugeiconsIcon icon={Add01Icon} aria-hidden />
      </Button>
      <ClubSheet open={open} onOpenChange={setOpen} mode="create" />
    </>
  );
}
