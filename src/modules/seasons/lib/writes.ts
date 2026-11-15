import { and, desc, eq, sql } from "drizzle-orm";

import type { Transaction } from "@/db";
import { seasons } from "@/db/schema";

export type Season = typeof seasons.$inferSelect;

export type NewTournamentSeason = {
  /** Null means the Club's Current Season, creating Season 1 if it has none. */
  seasonId: number | null;
  /** Wins over `seasonId`. */
  startNextSeason: boolean;
};

/**
 * The Season a new Tournament goes in (ADR 0004). May create a Season, so the
 * caller inserts the Tournament in the same transaction.
 */
export async function resolveNewTournamentSeason(
  tx: Transaction,
  clubId: number,
  choice: NewTournamentSeason,
): Promise<Season> {
  // Serializes Season creation per Club so concurrent creates can't race on
  // the next number.
  await tx.execute(sql`select id from clubs where id = ${clubId} for update`);

  if (choice.startNextSeason) {
    const current = await getCurrentSeason(tx, clubId);
    return insertSeason(tx, clubId, (current?.number ?? 0) + 1);
  }
  if (choice.seasonId != null) return requireClubSeason(tx, choice.seasonId, clubId);
  return (await getCurrentSeason(tx, clubId)) ?? insertSeason(tx, clubId, 1);
}

export async function requireClubSeason(
  tx: Transaction,
  seasonId: number,
  clubId: number,
): Promise<Season> {
  const [season] = await tx
    .select()
    .from(seasons)
    .where(and(eq(seasons.id, seasonId), eq(seasons.clubId, clubId)))
    .limit(1);
  if (!season) throw new Error("Selected Season does not belong to this Club.");
  return season;
}

// A Club's Current Season is its highest-numbered one; null until it has any.
async function getCurrentSeason(tx: Transaction, clubId: number) {
  const [season] = await tx
    .select()
    .from(seasons)
    .where(eq(seasons.clubId, clubId))
    .orderBy(desc(seasons.number))
    .limit(1);
  return season ?? null;
}

async function insertSeason(tx: Transaction, clubId: number, number: number) {
  const [season] = await tx.insert(seasons).values({ clubId, number }).returning();
  return season;
}
