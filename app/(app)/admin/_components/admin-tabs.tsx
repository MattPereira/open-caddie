"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersPanel } from "./users-panel";
import type { AdminUser } from "./user-sheet";
import { TournamentsPanel } from "./tournaments-panel";
import type { AdminTournament, ClubOption } from "./tournament-sheet";
import { ClubsPanel } from "./clubs-panel";
import type { AdminClub } from "./club-sheet";
import { CoursesPanel } from "./courses-panel";
import type { AdminCourse } from "./course-sheet";

type AdminTabsProps = {
  users: AdminUser[];
  tournaments: AdminTournament[];
  clubs: ClubOption[];
  adminClubs: AdminClub[];
  courses: AdminCourse[];
};

export function AdminTabs({
  users,
  tournaments,
  clubs,
  adminClubs,
  courses,
}: AdminTabsProps) {
  return (
    <Tabs defaultValue="users" className="w-full">
      <TabsList>
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="clubs">Clubs</TabsTrigger>
        <TabsTrigger value="tournaments">Tournaments</TabsTrigger>
        <TabsTrigger value="courses">Courses</TabsTrigger>
      </TabsList>
      <TabsContent value="users" className="mt-4">
        <UsersPanel users={users} />
      </TabsContent>
      <TabsContent value="clubs" className="mt-4">
        <ClubsPanel clubs={adminClubs} />
      </TabsContent>
      <TabsContent value="tournaments" className="mt-4">
        <TournamentsPanel
          tournaments={tournaments}
          clubs={clubs}
          courses={courses}
        />
      </TabsContent>

      <TabsContent value="courses" className="mt-4">
        <CoursesPanel courses={courses} />
      </TabsContent>
    </Tabs>
  );
}
