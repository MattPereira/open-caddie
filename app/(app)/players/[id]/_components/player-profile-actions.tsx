"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  UserSheet,
  type AdminUser,
} from "@/app/(app)/admin/_components/user-sheet";
import { Button } from "@/components/ui/button";

export function PlayerProfileActions({
  player,
  canManageUsers,
}: {
  player: AdminUser;
  canManageUsers: boolean;
}) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  const refreshPage = () => {
    router.refresh();
  };

  return (
    <>
      <Button variant="outline" size="lg" onClick={() => setSheetOpen(true)}>
        <HugeiconsIcon icon={Edit03Icon} data-icon="inline-start" />
        Edit
      </Button>
      <UserSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode="edit"
        user={player}
        canManageUsers={canManageUsers}
        onSaved={refreshPage}
        onDeleted={refreshPage}
      />
    </>
  );
}
