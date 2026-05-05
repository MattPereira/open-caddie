"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersPanel } from "./users-panel";
import type { AdminUser } from "./user-sheet";
import { TournamentsPanel } from "./tournaments-panel";
import type {
  AdminTournament,
  ClubOption,
  CourseOption,
} from "./tournament-sheet";
import { SeasonsPanel } from "./seasons-panel";
import type { AdminSeason } from "./season-sheet";
import { ClubsPanel } from "./clubs-panel";
import type { AdminClub } from "./club-sheet";

type AdminTabsProps = {
  users: AdminUser[];
  tournaments: AdminTournament[];
  seasons: AdminSeason[];
  clubs: ClubOption[];
  adminClubs: AdminClub[];
  courses: CourseOption[];
};

export function AdminTabs({
  users,
  tournaments,
  seasons,
  clubs,
  adminClubs,
  courses,
}: AdminTabsProps) {
  return (
    <Tabs defaultValue="users" className="w-full">
      <TabsList>
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="clubs">Clubs</TabsTrigger>
        <TabsTrigger value="seasons">Seasons</TabsTrigger>
        <TabsTrigger value="tournaments">Tournaments</TabsTrigger>
        <TabsTrigger value="courses">Courses</TabsTrigger>
      </TabsList>
      <TabsContent value="users" className="mt-4">
        <UsersPanel users={users} />
      </TabsContent>
      <TabsContent value="clubs" className="mt-4">
        <ClubsPanel clubs={adminClubs} />
      </TabsContent>
      <TabsContent value="seasons" className="mt-4">
        <SeasonsPanel seasons={seasons} clubs={clubs} />
      </TabsContent>
      <TabsContent value="tournaments" className="mt-4">
        <TournamentsPanel
          tournaments={tournaments}
          clubs={clubs}
          courses={courses}
        />
      </TabsContent>

      <TabsContent value="courses" className="mt-4">
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Coming soon.
        </p>
      </TabsContent>
    </Tabs>
  );
}
