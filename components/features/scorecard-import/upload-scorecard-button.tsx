import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Upload03Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function UploadScorecardButton({
  href,
  className = "flex-1 sm:flex-none",
}: {
  href: string;
  className?: string;
}) {
  return (
    <Button asChild variant="outline" size="lg" className={cn(className)}>
      <Link href={href}>
        <HugeiconsIcon icon={Upload03Icon} data-icon="inline-start" />
        Upload scores
      </Link>
    </Button>
  );
}
