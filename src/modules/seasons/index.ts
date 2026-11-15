export {
  getClubSeasons,
  getSeasonStandings,
  type SeasonStandings,
} from "./lib/reads";
export {
  computeSeasonStandings,
  type ComputedSeasonStandings,
  type SeasonStandingsRoundInput,
  type SeasonStandingsTournamentInput,
} from "./lib/standings";
// Tournament writes call these inside their own transaction so a new Season
// and its Tournament commit together (ADR 0004).
export {
  requireClubSeason,
  resolveNewTournamentSeason,
  type NewTournamentSeason,
  type Season,
} from "./lib/writes";
