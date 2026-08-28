"use client";

import { useRef } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  TournamentForm,
  type TournamentFormHandle,
} from "./tournament-form";

export type {
  ClubOption,
  CourseOption,
  TeeOption,
  TournamentSheetTournament,
} from "./tournament-form";

import type { ClubOption, CourseOption } from "./tournament-form";

// Editing a Tournament happens on /tournaments/[id]/edit; the sheet is the
// create flow only.
type TournamentSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clubs: ClubOption[];
  courses: CourseOption[];
  redirectOnCreate?: boolean;
};

export function TournamentSheet({
  open,
  onOpenChange,
  clubs,
  courses,
  redirectOnCreate = false,
}: TournamentSheetProps) {
  const formRef = useRef<TournamentFormHandle>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    // The form owns the unsaved-changes state, so it decides whether closing
    // needs a discard confirm first.
    formRef.current?.requestClose();
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add tournament</SheetTitle>
          <SheetDescription>
            Schedule a new tournament for a club.
          </SheetDescription>
        </SheetHeader>

        <TournamentForm
          surface="sheet"
          mode="create"
          clubs={clubs}
          courses={courses}
          isOpen={open}
          onCloseAction={() => onOpenChange(false)}
          redirectOnCreate={redirectOnCreate}
          handleRef={formRef}
        />
      </SheetContent>
    </Sheet>
  );
}
