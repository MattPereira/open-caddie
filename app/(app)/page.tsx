import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ChampionIcon,
  GolfBallIcon,
  GolfBatIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";

import { EventCard } from "@/components/event-card";
import { PageContent } from "@/components/page-content";
import { matchFormatLabel } from "@/lib/match-play";
import { brandFont } from "@/lib/fonts";
import { getAllClubs } from "@/db/queries/clubs";
import { getCoursesWithTees } from "@/db/queries/courses";
import { getActiveRoundForUser } from "@/db/queries/rounds";
import { getAllTournaments } from "@/db/queries/tournaments";
import { getAllMatches } from "@/db/queries/matches";
import { getAllUsers, getCurrentUser } from "@/db/queries/users";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AddMatchButton } from "./matches/_components/add-match-button";
import { AddTournamentButton } from "./tournaments/_components/add-tournament-button";

const RECENT_LIMIT = 3;

export default async function Home() {
  const currentUser = await getCurrentUser();

  const [tournaments, matches, activeRound, courses, players, clubs] =
    await Promise.all([
      getAllTournaments(),
      getAllMatches(),
      currentUser ? getActiveRoundForUser(currentUser.id) : null,
      currentUser ? getCoursesWithTees() : [],
      currentUser ? getAllUsers() : [],
      currentUser?.isAdmin ? getAllClubs() : [],
    ]);

  return (
    <PageContent className="max-w-4xl gap-10">
      <section className="flex flex-col items-center gap-3 text-center">
        <div className="relative aspect-21/9 w-full overflow-hidden rounded-xl bg-zinc-900 sm:aspect-3/1">
          <Image
            src="/poipu-bay.jpg"
            alt="Open Caddie"
            fill
            sizes="100vw"
            priority
            className="object-cover object-bottom"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-linear-to-b from-black/50 via-black/15 to-black/30"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <h1
              className={cn(
                brandFont.className,
                "text-5xl text-white [text-shadow:0_2px_12px_rgb(0_0_0_/_0.6)] sm:text-7xl md:text-8xl",
              )}
            >
              Open Caddie
            </h1>
          </div>
        </div>
        <p className="max-w-sm text-base text-foreground/80 sm:max-w-none sm:text-lg">
          Track match play, skins games, and club tournaments with season-long
          standings
        </p>
      </section>
      <div className="flex w-full flex-col gap-8">
        {activeRound ? (
          <div className="flex flex-col items-center gap-2">
            <Button asChild size="xl" className="w-full md:w-1/2">
              <Link href={`/rounds/${activeRound.roundId}`}>
                <HugeiconsIcon icon={GolfBatIcon} size={20} aria-hidden />
                Play round
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground">
              In progress at {activeRound.courseName}
            </p>
          </div>
        ) : null}
        <RecentEventsSections
          tournaments={tournaments.slice(0, RECENT_LIMIT)}
          matches={matches.slice(0, RECENT_LIMIT)}
          tournamentAction={
            currentUser?.isAdmin ? (
              <AddTournamentButton
                clubs={clubs}
                courses={courses}
                redirectOnCreate
              />
            ) : null
          }
          matchAction={
            currentUser ? (
              <AddMatchButton
                courses={courses}
                players={players}
                redirectOnCreate
              />
            ) : null
          }
        />
      </div>
    </PageContent>
  );
}

type RecentTournament = Awaited<ReturnType<typeof getAllTournaments>>[number];
type RecentMatch = Awaited<ReturnType<typeof getAllMatches>>[number];

function RecentEventsSections({
  tournaments,
  matches,
  tournamentAction,
  matchAction,
}: {
  tournaments: RecentTournament[];
  matches: RecentMatch[];
  tournamentAction?: ReactNode;
  matchAction?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-0">
          <SectionHeader
            icon={ChampionIcon}
            title="Tournaments"
            href="/tournaments"
            action={tournamentAction}
          />
          <p className="text-sm text-muted-foreground">
            Club events that count toward season long standings
          </p>
        </div>
        {tournaments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tournaments yet.</p>
        ) : (
          tournaments.map((tournament) => (
            <EventCard
              key={tournament.id}
              event={{
                title: tournament.clubName,
                date: tournament.date,
                courseName: tournament.courseName,
                courseImgUrl: tournament.courseImgUrl,
                playerCount: tournament.playerCount,
              }}
              href={`/tournaments/${tournament.id}`}
            />
          ))
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-0">
          <SectionHeader
            icon={GolfBallIcon}
            title="Matches"
            href="/matches"
            action={matchAction}
          />
          <p className="text-sm text-muted-foreground">
            Singles and team match play for friendly competition
          </p>
        </div>
        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches yet.</p>
        ) : (
          matches.map((match) => (
            <EventCard
              key={match.id}
              event={{
                title: matchFormatLabel(match.format),
                date: match.date,
                courseName: match.courseName,
                courseImgUrl: match.courseImgUrl,
                playerCount: match.playerCount,
              }}
              href={`/matches/${match.id}`}
            />
          ))
        )}
      </section>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  href,
  action,
}: {
  icon: IconSvgElement;
  title: string;
  href: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Link
        href={href}
        className="flex items-center gap-2 text-lg font-semibold tracking-normal hover:text-primary"
      >
        <HugeiconsIcon icon={icon} size={22} aria-hidden />
        <span>{title}</span>
      </Link>
      {action}
    </div>
  );
}
