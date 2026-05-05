import { redirect } from "next/navigation";

import { getAllClubs } from "@/db/queries/clubs";
import { getAllCourses } from "@/db/queries/courses";
import { getAllSeasons } from "@/db/queries/seasons";
import { getAllTournaments } from "@/db/queries/tournaments";
import { getAllUsers, getCurrentUser } from "@/db/queries/users";
import { AdminTabs } from "./_components/admin-tabs";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();

  if (!user?.isAdmin) {
    redirect("/");
  }

  const [users, tournaments, seasons, clubs, courses] = await Promise.all([
    getAllUsers(),
    getAllTournaments(),
    getAllSeasons(),
    getAllClubs(),
    getAllCourses(),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <h1 className="text-2xl font-semibold">Admin Console</h1>
      <AdminTabs
        users={users}
        tournaments={tournaments}
        seasons={seasons}
        clubs={clubs}
        courses={courses}
      />
    </main>
  );
}
