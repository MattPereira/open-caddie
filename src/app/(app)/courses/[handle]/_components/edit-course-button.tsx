import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Edit03Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";

export function EditCourseButton({ course }: { course: { handle: string } }) {
  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      aria-label="Edit course"
      className="ml-auto"
    >
      <Link href={`/courses/${course.handle}/edit`}>
        <HugeiconsIcon icon={Edit03Icon} aria-hidden />
      </Link>
    </Button>
  );
}
