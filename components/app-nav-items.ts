import type { IconSvgElement } from "@hugeicons/react";
import {
  ChampionIcon,
  GolfCartIcon,
  GolfHoleIcon,
  GolfBallIcon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";

import { CrossedClubsIcon } from "@/components/icons/crossed-clubs";

type AppNavItem = {
  title: string;
  href: string;
  icon: IconSvgElement;
};

export const appPageIcons = {
  tournaments: ChampionIcon,
  standings: ChampionIcon,
  matches: GolfBallIcon,
  records: GolfCartIcon,
  greenies: GolfHoleIcon,
  courses: GolfHoleIcon,
  players: UserMultipleIcon,
  clubs: CrossedClubsIcon,
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
