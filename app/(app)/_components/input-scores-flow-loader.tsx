import { getAllCourses } from "@/db/queries/courses";
import { getActiveRoundForUser, getRoundById } from "@/db/queries/rounds";
import { getUpcomingTournamentsForUser } from "@/db/queries/tournaments";
import { toIsoDate } from "@/lib/utils";
import { InputScoresFlow, type ActiveRound } from "./input-scores-flow";

export async function InputScoresFlowLoader({ userId }: { userId: string }) {
  const [courses, tournaments, activeRow] = await Promise.all([
    getAllCourses(),
    getUpcomingTournamentsForUser(userId),
    getActiveRoundForUser(userId),
  ]);

  const activeRoundDetails = activeRow
    ? await getRoundById(activeRow.roundId)
    : null;

  const activeCourse =
    activeRow != null
      ? courses.find((course) => course.id === activeRow.courseId)
      : undefined;

  const activeRound: ActiveRound | null =
    activeRow && activeRoundDetails
      ? {
          roundId: activeRow.roundId,
          courseName: activeRow.courseName,
          date: activeRow.date,
          tournamentLabel:
            activeRow.tournamentId != null
              ? `Tournament${activeRow.tournamentSeason ? ` · Season ${activeRow.tournamentSeason}` : ""}`
              : null,
          holes: (activeCourse?.holes ?? []).map((hole) => ({
            hole: hole.hole,
            par: hole.par,
          })),
          tableRound: {
            id: activeRoundDetails.id,
            tournamentId: activeRoundDetails.tournamentId,
            userId: activeRoundDetails.userId,
            courseName: activeRoundDetails.courseName,
            firstName: activeRoundDetails.firstName,
            lastName: activeRoundDetails.lastName,
            username: activeRoundDetails.username,
            image: activeRoundDetails.image,
            recordedStrokesCount: activeRoundDetails.recordedStrokesCount,
            recordedPuttsCount: activeRoundDetails.recordedPuttsCount,
            totalStrokes: activeRoundDetails.totalStrokes,
            totalPutts: activeRoundDetails.totalPutts,
            tournamentHandicap: activeRoundDetails.tournamentHandicap,
            netStrokes: activeRoundDetails.netStrokes,
            scores: activeRoundDetails.scores.map((score) => ({
              hole: score.hole,
              par: score.par,
              strokes: score.strokes,
              putts: score.putts,
            })),
            holes: activeRoundDetails.holes.map((hole) => ({
              hole: hole.hole,
              par: hole.par,
            })),
            greenies: activeRoundDetails.greenies.map((greenie) => ({
              hole: greenie.hole,
              feet: greenie.feet,
              inches: greenie.inches,
            })),
          },
        }
      : null;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return (
    <InputScoresFlow
      defaultDateIso={toIsoDate(today)}
      courses={courses.map((course) => ({
        handle: course.handle,
        name: course.name,
        rating: course.rating,
        slope: course.slope,
        imgUrl: course.imgUrl,
      }))}
      tournaments={tournaments.map((tournament) => ({
        id: tournament.id,
        date: tournament.date,
        startsAt: tournament.startsAt,
        season: tournament.season,
        clubName: tournament.clubName,
        courseImgUrl: tournament.courseImgUrl,
        courseHandle: tournament.courseHandle,
        courseName: tournament.courseName,
      }))}
      activeRound={activeRound}
    />
  );
}
