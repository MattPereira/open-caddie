import { eq, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { matches, rounds, tournaments } from "@/db/schema";

export type EventKind = "tournament" | "match";

type EventKindConfig = {
  notFoundError: string;
  path: (eventId: number) => string;
  roundsOf: (eventId: number) => SQL;
  readCourseId: (eventId: number) => Promise<number | null>;
  uploadColumns: (eventId: number) => {
    tournamentId: number | null;
    matchId: number | null;
  };
};

export const EVENT_KINDS: Record<EventKind, EventKindConfig> = {
  tournament: {
    notFoundError: "Tournament not found.",
    path: (eventId) => `/tournaments/${eventId}`,
    roundsOf: (eventId) => eq(rounds.tournamentId, eventId),
    readCourseId: async (eventId) => {
      const [event] = await db
        .select({ courseId: tournaments.courseId })
        .from(tournaments)
        .where(eq(tournaments.id, eventId))
        .limit(1);
      return event?.courseId ?? null;
    },
    uploadColumns: (eventId) => ({ tournamentId: eventId, matchId: null }),
  },
  match: {
    notFoundError: "Match not found.",
    path: (eventId) => `/matches/${eventId}`,
    roundsOf: (eventId) => eq(rounds.matchId, eventId),
    readCourseId: async (eventId) => {
      const [event] = await db
        .select({ courseId: matches.courseId })
        .from(matches)
        .where(eq(matches.id, eventId))
        .limit(1);
      return event?.courseId ?? null;
    },
    uploadColumns: (eventId) => ({ tournamentId: null, matchId: eventId }),
  },
};
