"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Edit03Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  TournamentSheet,
  type ClubOption,
  type CourseOption,
  type TournamentSheetTournament,
} from "../../_components/tournament-sheet";

type EditTournamentButtonProps = {
  tournament: TournamentSheetTournament;
  clubs: ClubOption[];
  courses: CourseOption[];
};

export function EditTournamentButton({
  tournament,
  clubs,
  courses,
}: EditTournamentButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Edit tournament"
        onClick={() => setOpen(true)}
      >
        <HugeiconsIcon icon={Edit03Icon} aria-hidden />
      </Button>
      <TournamentSheet
        open={open}
        onOpenChange={setOpen}
        mode="edit"
        tournament={tournament}
        clubs={clubs}
        courses={courses}
      />
    </>
  );
}
