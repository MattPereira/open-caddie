import type { IconSvgElement } from "@hugeicons/react";
import {
  ChampionIcon,
  GolfBatIcon,
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
  matches: GolfBatIcon,
  standings: ChampionIcon,
  greenies: GolfHoleIcon,
  courses: GolfCartIcon,
  players: UserMultipleIcon,
  clubs: GolfBatIcon,
} satisfies Record<string, IconSvgElement>;

export const appNavItems: AppNavItem[] = [
  {
    title: "Tournaments",
    href: "/tournaments",
    icon: appPageIcons.tournaments,
  },
  {
    title: "Matches",
    href: "/matches",
    icon: appPageIcons.matches,
  },
  { title: "Standings", href: "/standings", icon: appPageIcons.standings },
  { title: "Greenies", href: "/greenies", icon: appPageIcons.greenies },
  { title: "Courses", href: "/courses", icon: appPageIcons.courses },
  { title: "Players", href: "/players", icon: appPageIcons.players },
  { title: "Clubs", href: "/clubs", icon: appPageIcons.clubs },
];
