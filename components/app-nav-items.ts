import type { IconSvgElement } from "@hugeicons/react";
import {
  ChampionIcon,
  GolfBatIcon,
  GolfCartIcon,
  GolfHoleIcon,
  GolfBallIcon,
  Award02Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";

type AppNavItem = {
  title: string;
  href: string;
  icon: IconSvgElement;
};

export const appPageIcons = {
  tournaments: ChampionIcon,
  standings: ChampionIcon,
  matches: GolfBallIcon,
  records: Award02Icon,
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
  { title: "Matches", href: "/matches", icon: appPageIcons.matches },
  { title: "Courses", href: "/courses", icon: appPageIcons.courses },
  { title: "Records", href: "/records", icon: appPageIcons.records },
  { title: "Players", href: "/players", icon: appPageIcons.players },
  { title: "Clubs", href: "/clubs", icon: appPageIcons.clubs },
];
