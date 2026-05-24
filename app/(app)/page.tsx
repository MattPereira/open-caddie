import Link from "next/link";
import {
  ChampionIcon,
  GolfBallIcon,
  GolfBatIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";

import { auth } from "@/auth";
import { EventCard } from "@/components/event-card";
import { PageContent } from "@/components/page-content";
import { matchFormatLabel } from "@/lib/match-play";
import { brandFont } from "@/lib/fonts";
import { getActiveRoundForUser } from "@/db/queries/rounds";
import { getAllTournaments } from "@/db/queries/tournaments";
import { getAllMatches } from "@/db/queries/matches";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const RECENT_LIMIT = 3;

export default async function Home() {
  const session = await auth();
  const userId = session?.user?.id;

  const [tournaments, matches, activeRound] = await Promise.all([
    getAllTournaments(),
    getAllMatches(),
    userId ? getActiveRoundForUser(userId) : null,
  ]);

  return (
    <PageContent className="max-w-4xl">
      <section className="flex flex-col items-center gap-3 pt-6 text-center">
        <h1 className={cn(brandFont.className, "text-5xl sm:text-6xl")}>
          Open Caddie
        </h1>
        <p className="max-w-sm text-muted-foreground sm:max-w-none">
          A golf scorekeeping app for casual rounds, competitive formats, and
          club organizations
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
}: {
  tournaments: RecentTournament[];
  matches: RecentMatch[];
}) {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      <section className="flex flex-col gap-3">
        <SectionHeader
          icon={ChampionIcon}
          title="Tournaments"
          href="/tournaments"
        />
        {tournaments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tournaments yet.</p>
        ) : (
          tournaments.map((tournament) => (
            <EventCard
              key={tournament.id}
              event={{
                title: tournament.clubName,
                date: tournament.date,
                startsAt: tournament.startsAt,
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
        <SectionHeader icon={GolfBallIcon} title="Matches" href="/matches" />
        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches yet.</p>
        ) : (
          matches.map((match) => (
            <EventCard
              key={match.id}
              event={{
                title: matchFormatLabel(match.format),
                date: match.date,
                startsAt: match.startsAt,
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
}: {
  icon: IconSvgElement;
  title: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 text-lg font-semibold tracking-normal hover:text-primary"
    >
      <HugeiconsIcon icon={icon} size={22} aria-hidden />
      <span>{title}</span>
    </Link>
  );
}
