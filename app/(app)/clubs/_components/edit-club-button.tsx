"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Edit03Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";

export function EditClubButton({ club }: { club: { handle: string } }) {
  return (
    <Button variant="ghost" size="icon" aria-label="Edit club" asChild>
      <Link href={`/clubs/${club.handle}/edit`}>
        <HugeiconsIcon icon={Edit03Icon} aria-hidden />
      </Link>
    </Button>
  );
}
