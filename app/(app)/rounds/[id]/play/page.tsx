import { notFound } from "next/navigation";

import { getRoundById } from "@/db/queries/rounds";
import { getCurrentUser } from "@/db/queries/users";
import { RoundPlay } from "./_components/round-play";

type PlayPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function PlayRoundPage({ params }: PlayPageProps) {
  const { id } = await params;
  const roundId = Number(id);
  if (!Number.isInteger(roundId) || roundId <= 0) notFound();

  const [round, currentUser] = await Promise.all([
    getRoundById(roundId),
    getCurrentUser(),
  ]);

  if (!round || !currentUser) notFound();
  if (currentUser.id !== round.userId && !currentUser.isAdmin) notFound();

  const tableRound = {
    id: round.id,
    tournamentId: round.tournamentId,
    userId: round.userId,
    courseName: round.courseName,
    firstName: round.firstName,
    lastName: round.lastName,
    username: round.username,
    image: round.image,
    recordedStrokesCount: round.recordedStrokesCount,
    recordedPuttsCount: round.recordedPuttsCount,
    totalStrokes: round.totalStrokes,
    totalPutts: round.totalPutts,
    tournamentHandicap: round.tournamentHandicap,
    netStrokes: round.netStrokes,
    scores: round.scores.map((score) => ({
      hole: score.hole,
      par: score.par,
      strokes: score.strokes,
      putts: score.putts,
    })),
    holes: round.holes.map((hole) => ({ hole: hole.hole, par: hole.par })),
    greenies: round.greenies.map((greenie) => ({
      hole: greenie.hole,
      feet: greenie.feet,
      inches: greenie.inches,
    })),
  };

  return (
    <main className="flex min-h-[calc(100svh-3.5rem)] flex-col items-center p-5">
      <section className="flex w-full max-w-md flex-1 flex-col justify-center gap-6 sm:flex-none">
        <RoundPlay
          roundId={round.id}
          tableRound={tableRound}
          courseImgUrl={round.courseImgUrl}
          date={round.date}
          clubName={round.clubName}
          tournamentSeason={round.tournamentSeason}
          holes={tableRound.holes}
        />
      </section>
    </main>
  );
}
