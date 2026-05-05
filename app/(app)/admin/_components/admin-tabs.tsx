"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersPanel } from "./users-panel";
import type { AdminUser } from "./user-sheet";

type AdminTabsProps = {
  users: AdminUser[];
};

export function AdminTabs({ users }: AdminTabsProps) {
  return (
    <Tabs defaultValue="users" className="w-full">
      <TabsList>
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="tournaments">Tournaments</TabsTrigger>
        <TabsTrigger value="courses">Courses</TabsTrigger>
      </TabsList>
      <TabsContent value="users" className="mt-4">
        <UsersPanel users={users} />
      </TabsContent>
      <TabsContent value="tournaments" className="mt-4">
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Coming soon.
        </p>
      </TabsContent>
      <TabsContent value="courses" className="mt-4">
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Coming soon.
        </p>
      </TabsContent>
    </Tabs>
  );
}
