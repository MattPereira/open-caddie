"use client";

import { useState } from "react";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import { MatchSheet, type CourseOption } from "./match-sheet";

type AddMatchButtonProps = {
  courses: CourseOption[];
};

export function AddMatchButton({ courses }: AddMatchButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Add match"
        disabled={courses.length === 0}
        onClick={() => setOpen(true)}
      >
        <HugeiconsIcon icon={Add01Icon} aria-hidden />
      </Button>
      <MatchSheet
        open={open}
        onOpenChange={setOpen}
        mode="create"
        courses={courses}
      />
    </>
  );
}
