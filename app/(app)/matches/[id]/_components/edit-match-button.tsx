"use client";

import { useState } from "react";
import { Edit03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import {
  MatchSheet,
  type CourseOption,
  type MatchSheetMatch,
} from "../../_components/match-sheet";

type EditMatchButtonProps = {
  match: MatchSheetMatch;
  courses: CourseOption[];
};

export function EditMatchButton({ match, courses }: EditMatchButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Edit match"
        onClick={() => setOpen(true)}
      >
        <HugeiconsIcon icon={Edit03Icon} aria-hidden />
      </Button>
      <MatchSheet
        open={open}
        onOpenChange={setOpen}
        mode="edit"
        match={match}
        courses={courses}
      />
    </>
  );
}
