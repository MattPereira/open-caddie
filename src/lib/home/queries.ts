import { unstable_cache } from "next/cache";

import { toIsoDate } from "@/lib/dates";
import { getAllMatches } from "@/lib/matches/queries";
import { getAllTournaments } from "@/lib/tournaments/queries";
import { HOME_EVENTS_CACHE_TAG } from "./cache";

export const getHomeEvents = unstable_cache(
  async () => {
    const [tournaments, matches] = await Promise.all([
      getAllTournaments(),
      getAllMatches(),
    ]);

    return {
      tournaments: tournaments.map((tournament) => ({
        id: tournament.id,
        date: toIsoDate(tournament.date),
        clubName: tournament.clubName,
        courseName: tournament.courseName,
        courseImgUrl: tournament.courseImgUrl,
        playerCount: tournament.playerCount,
      })),
      matches: matches.map((match) => ({
        id: match.id,
        date: toIsoDate(match.date),
        format: match.format,
        courseName: match.courseName,
        courseImgUrl: match.courseImgUrl,
        playerCount: match.playerCount,
      })),
    };
  },
  ["home-events"],
  {
    tags: [HOME_EVENTS_CACHE_TAG],
    // Relevant writes invalidate this tag; expiry would let crawlers wake Neon.
    revalidate: false,
  },
);
