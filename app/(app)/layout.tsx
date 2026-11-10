import Link from "next/link";

import { auth } from "@/auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { HeaderWordmark } from "@/components/layout/header-wordmark";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { getCurrentPlayer } from "@/lib/players/queries";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const player = session?.user
    ? ((await getCurrentPlayer()) ?? session.user)
    : null;
  const sidebarPlayer = player ? getSidebarPlayer(player) : null;

  return (
    <SidebarProvider>
      <AppSidebar player={sidebarPlayer} />
      <SidebarInset>
        <header className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b px-3">
          <SidebarTrigger className="size-8 justify-self-start" />
          <HeaderWordmark />
          {session?.user?.id ? (
            <ThemeToggle className="size-8 justify-self-end" />
          ) : (
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="justify-self-end"
            >
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

type SidebarSourcePlayer = {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
  image?: string | null;
  isAdmin?: boolean | null;
  id?: string | null;
};

function getSidebarPlayer(player: SidebarSourcePlayer) {
  const { firstName, lastName, username, email, image, isAdmin, id } = player;
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  return {
    name: fullName || username || email || "Account",
    email: email ?? "",
    image: image ?? null,
    isAdmin: isAdmin ?? false,
    id: id ?? "",
  };
}
