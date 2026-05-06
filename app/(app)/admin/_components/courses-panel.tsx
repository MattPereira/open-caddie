"use client";

import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Search01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MediaCard } from "@/components/media-card";
import { CourseSheet, type AdminCourse } from "./course-sheet";

type CoursesPanelProps = {
  courses: AdminCourse[];
};

export function CoursesPanel({ courses }: CoursesPanelProps) {
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"create" | "edit">("create");
  const [activeCourse, setActiveCourse] = useState<AdminCourse | undefined>();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) =>
      [c.name, c.handle].join(" ").toLowerCase().includes(q),
    );
  }, [courses, query]);

  const openCreate = () => {
    setSheetMode("create");
    setActiveCourse(undefined);
    setSheetOpen(true);
  };

  const openEdit = (course: AdminCourse) => {
    setSheetMode("edit");
    setActiveCourse(course);
    setSheetOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <HugeiconsIcon icon={Search01Icon} size={16} />
          </span>
          <Input
            type="search"
            placeholder="Search courses…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openCreate}>
          <HugeiconsIcon icon={Add01Icon} />
          Add course
        </Button>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No courses match.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {filtered.map((course) => (
            <MediaCard
              key={course.id}
              imageUrl={course.imgUrl}
              imageAlt={course.name}
              header={course.name}
              badges={[
                { label: `Rating ${course.rating}`, variant: "secondary" },
                { label: `Slope ${course.slope}`, variant: "secondary" },
              ]}
              onClick={() => openEdit(course)}
            ></MediaCard>
          ))}
        </div>
      )}

      <CourseSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={sheetMode}
        course={activeCourse}
      />
    </div>
  );
}
