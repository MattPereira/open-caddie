"use client";

import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { PlayerCard } from "@/components/player-card";
import { SearchInput } from "@/components/search-input";
import { UserSheet, type AdminUser } from "./user-sheet";

type UsersPanelProps = {
  users: AdminUser[];
};

export function UsersPanel({ users }: UsersPanelProps) {
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"create" | "edit">("create");
  const [activeUser, setActiveUser] = useState<AdminUser | undefined>();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const haystack = [u.email, u.firstName, u.lastName, u.username]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [users, query]);

  const openCreate = () => {
    setSheetMode("create");
    setActiveUser(undefined);
    setSheetOpen(true);
  };

  const openEdit = (user: AdminUser) => {
    setSheetMode("edit");
    setActiveUser(user);
    setSheetOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <SearchInput
          placeholder="Search users…"
          value={query}
          onValueChange={setQuery}
          wrapperClassName="w-full md:w-1/2"
        />
        <Button onClick={openCreate}>
          <HugeiconsIcon icon={Add01Icon} />
          Add user
        </Button>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No users match.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {filtered.map((user) => (
            <PlayerCard
              key={user.id}
              player={user}
              onClick={() => openEdit(user)}
            />
          ))}
        </div>
      )}

      <UserSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={sheetMode}
        user={activeUser}
      />
    </div>
  );
}
