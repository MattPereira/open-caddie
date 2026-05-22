"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ExpandIcon,
  UserCircleIcon,
  Logout01Icon,
  Sun01Icon,
  Moon02Icon,
  ComputerIcon,
} from "@hugeicons/core-free-icons";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { signOutAction } from "@/app/(app)/login/actions";
import { appNavItems } from "@/components/app-nav-items";

type SidebarUser = {
  name: string;
  email: string;
  image?: string | null;
  isAdmin: boolean;
  id: string;
};

export function AppSidebar({ user }: { user: SidebarUser | null }) {
  const pathname = usePathname();
  const { setTheme } = useTheme();
  const { isMobile, setOpenMobile } = useSidebar();
  const initials = user ? getInitials(user.name) : null;
  const closeMobileSidebar = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <Link
          href="/"
          onNavigate={closeMobileSidebar}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 font-brand text-[1.625rem] font-normal outline-hidden transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          Open Caddie
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {appNavItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname?.startsWith(`${item.href}/`);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} size="lg">
                      <Link href={item.href} onNavigate={closeMobileSidebar}>
                        <HugeiconsIcon icon={item.icon} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {user ? (
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="size-10">
                      {user.image ? (
                        <AvatarImage src={user.image} alt={user.name} />
                      ) : null}
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium text-base">
                        {user.name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </div>
                    <HugeiconsIcon icon={ExpandIcon} className="ml-auto" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                  side={isMobile ? "top" : "right"}
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild className="py-3 text-lg">
                      <Link
                        href={`/players/${user.id}`}
                        onNavigate={closeMobileSidebar}
                      >
                        <HugeiconsIcon icon={UserCircleIcon} className="size-5" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="py-3 text-lg">
                        <HugeiconsIcon icon={Sun01Icon} className="size-5" />
                        Theme
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem onSelect={() => setTheme("light")}>
                          <HugeiconsIcon icon={Sun01Icon} />
                          Light
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setTheme("dark")}>
                          <HugeiconsIcon icon={Moon02Icon} />
                          Dark
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setTheme("system")}>
                          <HugeiconsIcon icon={ComputerIcon} />
                          System
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="py-3 text-lg"
                    onSelect={(e) => {
                      e.preventDefault();
                      void signOutAction();
                    }}
                  >
                    <HugeiconsIcon icon={Logout01Icon} className="size-5" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      ) : null}
    </Sidebar>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
