import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Upload03Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";

export function UploadScorecardButton({ href }: { href: string }) {
  return (
    <Button asChild variant="outline" size="xl" className="flex-1 sm:flex-none">
      <Link href={href}>
        <HugeiconsIcon icon={Upload03Icon} data-icon="inline-start" />
        Upload scorecard
      </Link>
    </Button>
  );
}
