import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserGroupIcon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";

export function PairingsButton({ href }: { href: string }) {
  return (
    <Button
      asChild
      variant="outline"
      size="lg"
      className="w-[calc(50%-0.25rem)] sm:w-auto"
    >
      <Link href={href}>
        <HugeiconsIcon icon={UserGroupIcon} data-icon="inline-start" />
        Pairings
      </Link>
    </Button>
  );
}
