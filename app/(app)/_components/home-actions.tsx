import Link from "next/link";
import {
  GolfBallIcon,
  PlayCircleIcon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import { getActiveRoundForUser } from "@/db/queries/rounds";

export async function HomeActions({ userId }: { userId: string }) {
  const activeRound = await getActiveRoundForUser(userId);

  return (
    <div className="grid grid-cols-2 items-center gap-3 md:grid-cols-2">
      <Button asChild variant="outline" size="xl" className="w-full">
        <Link
          href={
            activeRound ? `/rounds/${activeRound.roundId}/play` : "/rounds/new"
          }
        >
          {activeRound ? (
            <>
              <HugeiconsIcon icon={PlayCircleIcon} data-icon="inline-start" />
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
  );
}
