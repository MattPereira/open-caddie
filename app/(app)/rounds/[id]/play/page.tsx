import { notFound } from "next/navigation";

import { getMatchById } from "@/lib/matches/queries";
import { getRoundById } from "@/lib/rounds/queries";
import {
  getPairingMatesForRound,
  getTournamentById,
} from "@/lib/tournaments/queries";
import { getCurrentUser } from "@/lib/users/queries";
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
  const [tournament, match, pairingMates] = await Promise.all([
    round.tournamentId == null
      ? Promise.resolve(null)
      : getTournamentById(round.tournamentId),
    round.matchId == null ? Promise.resolve(null) : getMatchById(round.matchId),
    // Keyed by this Round rather than its Tournament: the peers a player may
    // score for are their Pairing's, and the Tournament read is cached for
    // pages that want none of this.
    round.tournamentId == null
      ? Promise.resolve([])
      : getPairingMatesForRound(round.id),
  ]);

  const matchPeers =
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
  // A Round is in a Match or a Tournament, never both, so one of these is
  // always empty. A Pairing holds at most four Rounds, so a player's mates
  // never exceed the picker's cap of three.
  const scoringPeers = [...matchPeers, ...pairingMates];

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
    courseSlope: round.courseSlope,
    recordedStrokesCount: round.recordedStrokesCount,
    recordedPuttsCount: round.recordedPuttsCount,
    totalStrokes: round.totalStrokes,
    totalPutts: round.totalPutts,
    playerIndexOverride: round.playerIndexOverride,
    playingHandicap: round.playingHandicap,
    netStrokes: round.netStrokes,
    scores: round.scores.map((score) => ({
      hole: score.hole,
      par: score.par,
      handicap: null,
      strokes: score.strokes,
      putts: score.putts,
    })),
    holes: round.holes.map((hole) => ({
      hole: hole.hole,
      par: hole.par,
      handicap: hole.handicap,
      yards: hole.yards,
    })),
    greenies: round.greenies.map((greenie) => ({
      hole: greenie.hole,
      feet: greenie.feet,
      inches: greenie.inches,
    })),
  };
  const scoreboardRounds =
    match?.rounds.map((matchRound) => ({
      id: matchRound.id,
      matchId: matchRound.matchId,
      tournamentId: null,
      teeId: matchRound.teeId,
      userId: matchRound.userId,
      courseName: matchRound.courseName,
      firstName: matchRound.firstName,
      lastName: matchRound.lastName,
      username: matchRound.username,
      image: matchRound.image,
      recordedStrokesCount: matchRound.recordedStrokesCount,
      recordedPuttsCount: matchRound.recordedPuttsCount,
      totalStrokes: matchRound.totalStrokes,
      totalPutts: matchRound.totalPutts,
      playerIndexOverride: matchRound.playerIndexOverride,
      playingHandicap: matchRound.playingHandicap,
      netStrokes: matchRound.netStrokes,
      scores: matchRound.scores,
      holes: matchRound.holes,
      greenies: matchRound.greenies,
    })) ?? [];
  const scoreboardRoundsById = new Map(
    scoreboardRounds.map((matchRound) => [matchRound.id, matchRound]),
  );
  const matchScoreboard = match
    ? {
        format: match.format,
        rounds: scoreboardRounds,
        teams: match.teams.map((team) => ({
          id: team.id,
          name: team.name,
          rounds: team.rounds
            .map((teamRound) => scoreboardRoundsById.get(teamRound.id))
            .filter((teamRound) => teamRound != null),
        })),
      }
    : null;

  return (
    <main className="flex min-h-[calc(100svh-3.5rem)] flex-col items-center p-5">
      <section className="flex w-full max-w-md flex-1 flex-col gap-6 sm:flex-none">
        <RoundPlay
          roundId={round.id}
          tableRound={tableRound}
          leaderboardRounds={tournament?.rounds}
          holes={tableRound.holes}
          tees={round.tees}
          scoringPeers={scoringPeers}
          prefillDelegateRoundIds={pairingMates.map((mate) => mate.roundId)}
          matchScoreboard={matchScoreboard}
        />
      </section>
    </main>
  );
}
