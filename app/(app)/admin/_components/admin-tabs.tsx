"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersPanel } from "./users-panel";
import type { AdminUser } from "./user-sheet";
import { ClubsPanel } from "./clubs-panel";
import type { AdminClub } from "./club-sheet";

type AdminTabsProps = {
  users: AdminUser[];
  adminClubs: AdminClub[];
};

export function AdminTabs({ users, adminClubs }: AdminTabsProps) {
  return (
    <Tabs defaultValue="users" className="w-full">
      <TabsList>
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="clubs">Clubs</TabsTrigger>
      </TabsList>
      <TabsContent value="users" className="mt-4">
        <UsersPanel users={users} />
      </TabsContent>
      <TabsContent value="clubs" className="mt-4">
        <ClubsPanel clubs={adminClubs} />
      </TabsContent>
    </Tabs>
  );
}
