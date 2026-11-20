import "server-only";

export {
  getAllPlayers,
  getCurrentPlayer,
  getPlayerById,
  getPlayerRoundsById,
  getPlayerStatsById,
  getSignedInPlayer,
  hasPlayerWithEmail,
} from "./lib/reads";
export { isPlatformAdmin, requirePlatformAdmin } from "./lib/platform-admin";
export {
  completeOnboarding,
  createFirstPlatformAdmin,
  createPlayer,
  deletePlayer,
  updatePlayer,
  type FirstPlatformAdminInput,
  type OnboardingResult,
  type PlayerCreateInput,
  type PlayerCreateResult,
  type PlayerUpdateInput,
  type PlayerWriteResult,
} from "./lib/writes";
