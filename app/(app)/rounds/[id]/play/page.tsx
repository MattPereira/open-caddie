import { notFound } from "next/navigation";

import { CourseRecords } from "@/components/features/course-records/course-records";
import { getMatchById } from "@/lib/matches/queries";
import { getRoundAccess, type AccessedRound } from "@/lib/rounds/access";
import { getRoundById } from "@/lib/rounds/queries";
import { getTournamentById } from "@/lib/tournaments/queries";
import { getCurrentUser } from "@/lib/users/queries";
import { RoundPlay } from "./_components/round-play";

type PlayPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

// The played Round's event, read once: its own Round, its mates' columns and
// both scoreboards all come out of the same Rounds.
async function readPlayEvent(round: AccessedRound) {
  if (round.tournamentId != null) {
    const tournament = await getTournamentById(round.tournamentId);
    return (
      tournament && {
        event: { kind: "tournament" as const, id: tournament.id },
        courseId: tournament.courseId,
        courseName: tournament.courseName,
        course: tournament.course,
        rounds: tournament.rounds,
        leaderboardRounds: tournament.rounds,
        matchScoreboard: null,
      }
    );
  }
  if (round.matchId != null) {
    const match = await getMatchById(round.matchId);
    return (
      match && {
        event: { kind: "match" as const, id: match.id },
        courseId: match.courseId,
        courseName: match.courseName,
        course: match.course,
        rounds: match.rounds,
        leaderboardRounds: undefined,
        matchScoreboard: {
          format: match.format,
          rounds: match.rounds,
          teams: match.teams,
        },
      }
    );
  }
  const casual = await getRoundById(round.id);
  return (
    casual && {
      event: null,
      courseId: casual.courseId,
      courseName: casual.courseName,
      course: casual.course,
      rounds: [casual],
      leaderboardRounds: undefined,
      matchScoreboard: null,
    }
  );
}

export default async function PlayRoundPage({ params }: PlayPageProps) {
  const { id } = await params;
  const roundId = Number(id);
  if (!Number.isInteger(roundId) || roundId <= 0) notFound();

  const currentUser = await getCurrentUser();
  if (!currentUser) notFound();
  const access = await getRoundAccess(currentUser.id, roundId);
  if (!access?.canScore) notFound();
  const play = await readPlayEvent(access.round);
  const round = play?.rounds.find((candidate) => candidate.id === roundId);
  if (!play || !round) notFound();

  const scorableRounds = access.otherScorableRoundIds.flatMap(
    (otherId) => play.rounds.find((candidate) => candidate.id === otherId) ?? [],
  );
  // A Pairing's card is kept together, so its mates start selected. A Scorer
  // who can't manage the Round has no Settings to pick players from, so every
  // scorable Round starts selected for them.
  const prefillDelegateRoundIds =
    play.event?.kind === "tournament" || !access.canManage
      ? access.otherScorableRoundIds
      : undefined;

  return (
    <main className="flex min-h-[calc(100svh-3.5rem)] flex-col items-center p-5">
      <section className="flex w-full max-w-md flex-1 flex-col gap-6 sm:flex-none">
        <RoundPlay
          currentUserId={currentUser.id}
          round={round}
          event={play.event}
          course={{ name: play.courseName, ...play.course }}
          leaderboardRounds={play.leaderboardRounds}
          scorableRounds={scorableRounds}
          prefillDelegateRoundIds={prefillDelegateRoundIds}
          canManage={access.canManage}
          matchScoreboard={play.matchScoreboard}
          courseRecords={<CourseRecords courseId={play.courseId} variant="tabs" />}
        />
      </section>
    </main>
  );
}
