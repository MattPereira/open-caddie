import { HOLE_COUNT } from "@/modules/courses";
import type { FixturePlayer, Fixtures } from "@/test/fixtures";

type Tournament = Awaited<ReturnType<Fixtures["tournament"]>>;

/** The shared fixtures plus ones only Round tests use. */
export function withRoundFixtures(fixtures: Fixtures) {
  async function yardages(
    courseHandle: string,
    teeId: number,
    yards: number[],
  ) {
    await fixtures.editTees(courseHandle, (tees) =>
      tees.map((t) => (t.id === teeId ? { ...t, yardages: yards } : t)),
    );
  }

  /**
   * Plays every hole in `totalStrokes`, two putts each. Fixture tees are rated
   * 72, so with their slope the Round's Score Differential scales back to
   * (totalStrokes - 72) as a Course Handicap.
   */
  async function completeCard(roundId: number, totalStrokes: number) {
    const lastHole = HOLE_COUNT - 1;
    await fixtures.scores(
      roundId,
      Array.from({ length: HOLE_COUNT }, (_, index) => ({
        hole: index + 1,
        strokes: index === lastHole ? totalStrokes - 4 * lastHole : 4,
        putts: 2,
      })),
    );
  }

  /** A complete Round for `entrant` in another Tournament of `t`'s Club and Season. */
  async function priorRound(
    t: Tournament,
    entrant: FixturePlayer,
    date: string,
    totalStrokes: number,
  ) {
    const other = await fixtures.tournament({
      club: t.club,
      seasonId: t.tournament.seasonId,
      date,
      on: t,
    });
    const { round } = await fixtures.tournamentPlayer(other, entrant);
    await completeCard(round.id, totalStrokes);
    return round;
  }

  return { ...fixtures, yardages, completeCard, priorRound };
}
