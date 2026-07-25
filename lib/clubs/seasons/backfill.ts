export type TournamentSeasonPair = {
  clubId: number;
  season: number | null;
};

export type SeasonBackfillRecord = {
  clubId: number;
  number: number;
  isCurrent: boolean;
};

/**
 * Derives the Club-owned Season records that back the existing
 * `(club_id, season)` groupings on Tournaments (ADR 0004). One Season is
 * created per distinct pair; each Club's highest existing number becomes its
 * Current Season. Tournaments without a season number contribute nothing.
 *
 * The `0012` backfill migration performs the equivalent set-based insert; this
 * function is the tested source of truth for that logic.
 */
export function computeSeasonBackfill(
  pairs: TournamentSeasonPair[],
): SeasonBackfillRecord[] {
  const numbersByClub = new Map<number, Set<number>>();

  for (const { clubId, season } of pairs) {
    if (season == null) continue;
    const numbers = numbersByClub.get(clubId) ?? new Set<number>();
    numbers.add(season);
    numbersByClub.set(clubId, numbers);
  }

  const records: SeasonBackfillRecord[] = [];

  for (const clubId of Array.from(numbersByClub.keys()).sort((a, b) => a - b)) {
    const numbers = Array.from(numbersByClub.get(clubId)!).sort((a, b) => a - b);
    const highest = numbers[numbers.length - 1];

    for (const number of numbers) {
      records.push({ clubId, number, isCurrent: number === highest });
    }
  }

  return records;
}
