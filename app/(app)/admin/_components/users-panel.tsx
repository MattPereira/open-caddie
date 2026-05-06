"use client";

import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SearchInput } from "@/components/search-input";
import { UserSheet, type AdminUser } from "./user-sheet";

type UsersPanelProps = {
  users: AdminUser[];
};

function displayName(user: AdminUser) {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return full || user.username || user.email || "Unnamed user";
}

function getInitials(user: AdminUser) {
  const first = user.firstName?.trim()?.[0];
  const last = user.lastName?.trim()?.[0];
  const initials = `${first ?? ""}${last ?? ""}`.toUpperCase();
  if (initials) return initials;
  const fallback = (user.username ?? user.email ?? "?").trim();
  return fallback.slice(0, 2).toUpperCase();
}

export function UsersPanel({ users }: UsersPanelProps) {
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"create" | "edit">("create");
  const [activeUser, setActiveUser] = useState<AdminUser | undefined>();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const haystack = [
        u.email,
        u.firstName,
        u.lastName,
        u.username,
      ]
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          placeholder="Search users…"
          value={query}
          onValueChange={setQuery}
          wrapperClassName="flex-1 sm:max-w-sm"
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((user) => (
            <Card key={user.id} className="gap-0 overflow-hidden py-0">
              <CardContent className="p-0">
                <button
                  type="button"
                  onClick={() => openEdit(user)}
                  className="flex w-full items-center gap-3 p-4 text-left hover:bg-accent"
                >
                  <Avatar className="size-10">
                    {user.image ? (
                      <AvatarImage src={user.image} alt={displayName(user)} />
                    ) : null}
                    <AvatarFallback>{getInitials(user)}</AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {displayName(user)}
                      </span>
                      {user.isAdmin ? (
                        <Badge variant="secondary">Admin</Badge>
                      ) : null}
                    </div>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email ?? "—"}
                    </span>
                  </div>
                </button>
              </CardContent>
            </Card>
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
