import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Edit03Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";

export function EditTournamentLink({ href }: { href: string }) {
  return (
    <Button asChild variant="secondary" size="xl">
      <Link href={href}>
        <HugeiconsIcon icon={Edit03Icon} data-icon="inline-start" />
        Edit
      </Link>
    </Button>
  );
}
