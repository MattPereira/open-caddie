"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserAdd02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import { UserSheet } from "./user-sheet";

export function AddPlayerButton() {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Add player"
        onClick={() => setSheetOpen(true)}
      >
        <HugeiconsIcon icon={UserAdd02Icon} />
      </Button>
      <UserSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode="create"
        onSaved={router.refresh}
      />
    </>
  );
}
