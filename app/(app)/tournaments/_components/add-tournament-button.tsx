"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  TournamentSheet,
  type ClubOption,
  type CourseOption,
} from "./tournament-sheet";

type AddTournamentButtonProps = {
  clubs: ClubOption[];
  courses: CourseOption[];
};

export function AddTournamentButton({
  clubs,
  courses,
}: AddTournamentButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Add tournament"
        disabled={clubs.length === 0}
        onClick={() => setOpen(true)}
      >
        <HugeiconsIcon icon={Add01Icon} aria-hidden />
      </Button>
      <TournamentSheet
        open={open}
        onOpenChange={setOpen}
        mode="create"
        clubs={clubs}
        courses={courses}
      />
    </>
  );
}
