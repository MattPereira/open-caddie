import type { IconSvgElement } from "@hugeicons/react";
import {
  ChampionIcon,
  GolfCartIcon,
  GolfHoleIcon,
  GolfBallIcon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";

type AppNavItem = {
  title: string;
  href: string;
  icon: IconSvgElement;
};

export const appPageIcons = {
  tournaments: GolfBallIcon,
  standings: ChampionIcon,
  greenies: GolfHoleIcon,
  courses: GolfCartIcon,
  players: UserMultipleIcon,
} satisfies Record<string, IconSvgElement>;

export const appNavItems: AppNavItem[] = [
  {
    title: "Tournaments",
    href: "/tournaments",
    icon: appPageIcons.tournaments,
  },
  { title: "Standings", href: "/standings", icon: appPageIcons.standings },
  { title: "Greenies", href: "/greenies", icon: appPageIcons.greenies },
  { title: "Courses", href: "/courses", icon: appPageIcons.courses },
  { title: "Players", href: "/players", icon: appPageIcons.players },
];
