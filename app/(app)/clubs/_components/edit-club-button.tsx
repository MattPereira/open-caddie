"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Edit03Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { ClubSheet, type AdminClub } from "./club-sheet";

export function EditClubButton({ club }: { club: AdminClub }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Edit club"
        onClick={() => setOpen(true)}
      >
        <HugeiconsIcon icon={Edit03Icon} aria-hidden />
      </Button>
      <ClubSheet open={open} onOpenChange={setOpen} mode="edit" club={club} />
    </>
  );
}
