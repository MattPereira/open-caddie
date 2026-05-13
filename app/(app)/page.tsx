import Link from "next/link";
import {
  GolfBallIcon,
  PlayCircleIcon,
  UserCircleIcon,
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
      <LoginPageForm
        hasAuthError={error !== undefined}
        rejectedEmail={email}
      />
    );

  const userId = session.user.id;
  const activeRound = await getActiveRoundForUser(userId);

  return (
    <main className="flex min-h-[calc(100svh-3.5rem)] flex-col items-center justify-center p-5">
      <section className="flex w-full max-w-3xl flex-col items-center gap-8">
        <h1 className="text-center text-2xl font-medium tracking-normal text-foreground sm:text-3xl">
          {session.user.firstName && `Swing away, ${session.user.firstName}`}
        </h1>
        <div className="grid grid-cols-2 items-center gap-3 md:grid-cols-2">
          <Button asChild variant="outline" size="xl" className="w-full">
            <Link
              href={
                activeRound
                  ? `/rounds/${activeRound.roundId}/play`
                  : "/rounds/new"
              }
            >
              {activeRound ? (
                <>
                  <HugeiconsIcon
                    icon={PlayCircleIcon}
                    data-icon="inline-start"
                  />
                  Resume round
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={GolfBallIcon} data-icon="inline-start" />
                  Play round
                </>
              )}
            </Link>
          </Button>
          <Button asChild variant="outline" size="xl" className="w-full">
            <Link href={`/players/${userId}`}>
              <HugeiconsIcon icon={UserCircleIcon} data-icon="inline-start" />
              See profile
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
