import Link from "next/link";
import {
  ChampionIcon,
  GolfBallIcon,
  GolfBatIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { getActiveRoundForUser } from "@/db/queries/rounds";
import { LoginPageForm } from "./_components/login-page-form";

type HomePageProps = {
  searchParams: Promise<{ error?: string; email?: string }>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const session = await auth();
  const { error, email } = await searchParams;

  if (!session?.user?.id)
    return (
      <LoginPageForm hasAuthError={error !== undefined} rejectedEmail={email} />
    );

  const userId = session.user.id;
  const activeRound = await getActiveRoundForUser(userId);

  return (
    <main className="flex min-h-[calc(100svh-3.5rem)] flex-col items-center justify-center p-5">
      <section className="flex w-full max-w-xs flex-col items-center gap-8">
        <h1 className="text-center text-2xl font-medium tracking-normal text-foreground sm:text-3xl">
          {session.user.firstName
            ? `Swing away, ${session.user.firstName}`
            : "Swing away"}
        </h1>
        <div className="flex w-full flex-col gap-3">
          <div className="flex w-full flex-col gap-1.5">
            <Button asChild size="xl" className="w-full">
              <Link
                href={
                  activeRound
                    ? `/rounds/${activeRound.roundId}/play`
                    : "/rounds/new"
                }
              >
                <HugeiconsIcon icon={GolfBallIcon} data-icon="inline-start" />
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
              <Link href={`/players/${userId}`}>
                <HugeiconsIcon icon={GolfBatIcon} data-icon="inline-start" />
                Past rounds
              </Link>
            </Button>
            <Button asChild variant="outline" size="xl" className="w-full">
              <Link href="/standings">
                <HugeiconsIcon icon={ChampionIcon} data-icon="inline-start" />
                Champions
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
