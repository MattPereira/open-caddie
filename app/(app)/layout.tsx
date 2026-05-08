import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { getCurrentUser } from "@/db/queries/users";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { firstName, lastName, username, email, image, isAdmin } = user;
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const sidebarUser = {
    name: fullName || username || email || "Account",
    email: email ?? "",
    image: image ?? null,
    isAdmin,
  };

  return (
    <SidebarProvider>
      <AppSidebar user={sidebarUser} />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-3">
          <SidebarTrigger className="size-8" />
          <ThemeToggle className="ml-auto size-8" />
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
