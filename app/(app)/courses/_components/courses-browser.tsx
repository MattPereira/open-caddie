"use client";

import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { GolfHoleIcon } from "@hugeicons/core-free-icons";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CourseCard } from "@/components/course-card";
import { SearchInput } from "@/components/search-input";

type Course = {
  id: number;
  handle: string;
  name: string;
  rating: string;
  slope: number;
  imgUrl: string | null;
};

export function CoursesBrowser({ courses }: { courses: Course[] }) {
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(
    () => filterCourses(courses, normalizedQuery),
    [courses, normalizedQuery],
  );

  return (
    <div className="flex flex-col gap-6">
      <SearchInput
        placeholder="Search courses..."
        value={query}
        onValueChange={setQuery}
        wrapperClassName="w-full md:w-1/2"
      />

      {courses.length === 0 ? (
        <EmptyCoursesState message="No courses are available yet." />
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-normal">Courses</h2>
            <Badge variant="secondary">{courses.length}</Badge>
          </div>

          {filtered.length === 0 ? (
            <EmptyCoursesState message="No courses match your search." />
          ) : (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {filtered.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  href={`/courses/${encodeURIComponent(course.handle)}`}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function EmptyCoursesState({ message }: { message: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <HugeiconsIcon icon={GolfHoleIcon} size={20} aria-hidden />
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}

function filterCourses(courses: Course[], query: string) {
  if (!query) return courses;

  return courses.filter((course) => {
    const haystack = [
      course.name,
      course.handle,
      `Rating ${course.rating}`,
      `Slope ${course.slope}`,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}
