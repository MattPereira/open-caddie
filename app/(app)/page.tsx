import Link from "next/link";
import {
  ChampionIcon,
  GolfBallIcon,
  GolfBatIcon,
  UserCircleIcon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { appNavItems } from "@/components/app-nav-items";
import { RotatingTagline } from "@/components/rotating-tagline";
import { brandFont } from "@/lib/fonts";
import { getActiveRoundForUser } from "@/db/queries/rounds";
import { cn } from "@/lib/utils";

export default async function Home() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <main className="flex min-h-[calc(100svh-3.5rem)] flex-col items-center justify-center gap-10 p-6">
        <section className="flex flex-col items-center gap-3 text-center">
          <h1 className={cn(brandFont.className, "text-5xl sm:text-6xl")}>
            Open Caddie
          </h1>
          <p className="max-w-sm text-muted-foreground sm:max-w-none">
            Track individual round scores, club tournaments, and season-long
            standings.
          </p>
        </section>
        <RotatingTagline />
        <div className="flex w-full max-w-sm flex-col gap-6">
          <Button asChild size="2xl" className="w-full">
            <Link href="/login">Sign in</Link>
          </Button>
          <div className="grid grid-cols-2 gap-3">
            {appNavItems
              .filter((item) => item.href !== "/greenies")
              .map((item) => (
                <Button
                  key={item.href}
                  asChild
                  variant="outline"
                  size="xl"
                  className="w-full"
                >
                  <Link href={item.href}>
                    <HugeiconsIcon icon={item.icon} data-icon="inline-start" />
                    {item.title}
                  </Link>
                </Button>
              ))}
          </div>
        </div>
      </main>
    );
  }

  const userId = session.user.id;
  const activeRound = await getActiveRoundForUser(userId);

  return (
    <main className="flex min-h-[calc(100svh-3.5rem)] flex-col items-center justify-center gap-10 p-6">
      <RotatingTagline />
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex w-full flex-col gap-1.5">
          <Button asChild size="2xl" className="w-full">
            <Link
              href={
                activeRound
                  ? `/rounds/${activeRound.roundId}/play`
                  : "/rounds/new"
              }
            >
              <HugeiconsIcon icon={GolfBatIcon} data-icon="inline-start" />
              Play round
            </Link>
          </Button>
          {activeRound ? (
            <p className="text-center text-sm text-muted-foreground">
              In progress at {activeRound.courseName}
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button asChild variant="outline" size="xl" className="w-full">
            <Link href="/tournaments">
              <HugeiconsIcon icon={GolfBallIcon} data-icon="inline-start" />
              Tournaments
            </Link>
          </Button>
          <Button asChild variant="outline" size="xl" className="w-full">
            <Link href="/standings">
              <HugeiconsIcon icon={ChampionIcon} data-icon="inline-start" />
              Standings
            </Link>
          </Button>
          <Button asChild variant="outline" size="xl" className="w-full">
            <Link href="/players">
              <HugeiconsIcon icon={UserMultipleIcon} data-icon="inline-start" />
              Players
            </Link>
          </Button>
          <Button asChild variant="outline" size="xl" className="w-full">
            <Link href={`/players/${userId}`}>
              <HugeiconsIcon icon={UserCircleIcon} data-icon="inline-start" />
              Profile
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
