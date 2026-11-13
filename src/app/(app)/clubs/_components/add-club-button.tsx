"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";

export function AddClubButton() {
  return (
    <Button variant="ghost" size="icon" aria-label="Add club" asChild>
      <Link href="/clubs/new">
        <HugeiconsIcon icon={Add01Icon} aria-hidden />
      </Link>
    </Button>
  );
}
