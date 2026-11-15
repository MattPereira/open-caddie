import "server-only";

export {
  getClubSeasons,
  getSeasonStandings,
  type SeasonStandings,
} from "./lib/reads";
// Take the caller's transaction so a new Season and its Tournament commit
// together (ADR 0004).
export {
  getOrCreateCurrentSeason,
  requireClubSeason,
  startNextSeason,
  type Season,
} from "./lib/writes";
