import { and, desc, eq, sql } from "drizzle-orm";

import type { Transaction } from "@/db";
import { seasons } from "@/db/schema";

export type Season = typeof seasons.$inferSelect;

/** Season 1 if the Club has none yet. */
export async function startNextSeason(tx: Transaction, clubId: number): Promise<Season> {
  await lockClubSeasons(tx, clubId);
  const current = await getCurrentSeason(tx, clubId);
  return insertSeason(tx, clubId, (current?.number ?? 0) + 1);
}

export async function getOrCreateCurrentSeason(tx: Transaction, clubId: number): Promise<Season> {
  await lockClubSeasons(tx, clubId);
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

// Serializes Season creation per Club so concurrent writes can't race on the
// next number. Held until the caller's transaction ends.
async function lockClubSeasons(tx: Transaction, clubId: number) {
  await tx.execute(sql`select id from clubs where id = ${clubId} for update`);
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
