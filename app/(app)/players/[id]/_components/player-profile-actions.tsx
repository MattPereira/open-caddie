"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import { UserSheet, type AdminUser } from "../../_components/user-sheet";
import { SignInLinkButton } from "./sign-in-link-button";

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
    <div className="relative flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
      <Button
        variant="secondary"
        size="xl"
        className="w-full sm:w-auto"
        onClick={() => setSheetOpen(true)}
      >
        <HugeiconsIcon icon={Edit03Icon} data-icon="inline-start" />
        Edit Player
      </Button>
      {canManageUsers ? <SignInLinkButton playerId={player.id} /> : null}
      <UserSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode="edit"
        user={player}
        canManageUsers={canManageUsers}
        onSaved={refreshPage}
        onDeleted={refreshPage}
      />
    </div>
  );
}
