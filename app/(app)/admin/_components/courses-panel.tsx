"use client";

import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Search01Icon } from "@hugeicons/core-free-icons";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((course) => (
            <Card key={course.id} className="gap-0 overflow-hidden py-0">
              <CardContent className="p-0">
                <button
                  type="button"
                  onClick={() => openEdit(course)}
                  className="flex w-full items-stretch text-left hover:bg-accent"
                >
                  <div className="relative w-28 shrink-0 self-stretch overflow-hidden rounded-r-xl bg-muted">
                    {course.imgUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={course.imgUrl}
                        alt={course.name}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1 p-4">
                    <span className="truncate text-base font-medium">
                      {course.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {course.handle}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">Rating {course.rating}</Badge>
                      <Badge variant="secondary">Slope {course.slope}</Badge>
                    </div>
                  </div>
                </button>
              </CardContent>
            </Card>
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
