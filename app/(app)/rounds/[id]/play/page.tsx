import { notFound } from "next/navigation";

import { getMatchById } from "@/db/queries/matches";
import { getRoundById } from "@/db/queries/rounds";
import { getTournamentById } from "@/db/queries/tournaments";
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
  const [tournament, match] = await Promise.all([
    round.tournamentId == null
      ? Promise.resolve(null)
      : getTournamentById(round.tournamentId),
    round.matchId == null ? Promise.resolve(null) : getMatchById(round.matchId),
  ]);

  const matchPlayers =
    match?.rounds
      .filter((matchRound) => matchRound.id !== round.id)
      .map((matchRound) => ({
        roundId: matchRound.id,
        userId: matchRound.userId,
        firstName: matchRound.firstName,
        lastName: matchRound.lastName,
        scores: matchRound.scores.map((score) => ({
          hole: score.hole,
          par: score.par,
          strokes: score.strokes,
          putts: score.putts,
        })),
        greenies: matchRound.greenies.map((greenie) => ({
          hole: greenie.hole,
          feet: greenie.feet,
          inches: greenie.inches,
        })),
      })) ?? [];

  const tableRound = {
    id: round.id,
    matchId: round.matchId,
    tournamentId: round.tournamentId,
    teeId: round.teeId,
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
    playingHandicap: round.playingHandicap,
    netStrokes: round.netStrokes,
    scores: round.scores.map((score) => ({
      hole: score.hole,
      par: score.par,
      strokes: score.strokes,
      putts: score.putts,
    })),
    holes: round.holes.map((hole) => ({
      hole: hole.hole,
      par: hole.par,
      yards: hole.yards,
    })),
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
          leaderboardRounds={tournament?.rounds}
          date={round.date}
          holes={tableRound.holes}
          tees={round.tees}
          matchPlayers={matchPlayers}
        />
      </section>
    </main>
  );
}
