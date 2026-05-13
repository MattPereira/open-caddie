"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Edit03Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  CourseSheet,
  type AdminCourse,
} from "@/app/(app)/admin/_components/course-sheet";

export function EditCourseButton({ course }: { course: AdminCourse }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Edit course"
        className="ml-auto"
        onClick={() => setOpen(true)}
      >
        <HugeiconsIcon icon={Edit03Icon} aria-hidden />
      </Button>
      <CourseSheet
        open={open}
        onOpenChange={setOpen}
        mode="edit"
        course={course}
      />
    </>
  );
}
