import { auth } from "@/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { getCurrentUser } from "@/db/queries/users";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user
    ? ((await getCurrentUser()) ?? session.user)
    : null;
  const sidebarUser = user ? getSidebarUser(user) : null;

  return (
    <SidebarProvider>
      <AppSidebar user={sidebarUser} />
      <SidebarInset>
        <header className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b px-3">
          <SidebarTrigger className="size-8 justify-self-start" />
          <Link href="/" className="justify-self-center text-lg font-semibold">
            Open Caddie
          </Link>
          <ThemeToggle className="size-8 justify-self-end" />
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

type SidebarSourceUser = {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
  image?: string | null;
  isAdmin?: boolean | null;
  id?: string | null;
};

function getSidebarUser(user: SidebarSourceUser) {
  const { firstName, lastName, username, email, image, isAdmin, id } = user;
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  return {
    name: fullName || username || email || "Account",
    email: email ?? "",
    image: image ?? null,
    isAdmin: isAdmin ?? false,
    id: id ?? "",
  };
}
