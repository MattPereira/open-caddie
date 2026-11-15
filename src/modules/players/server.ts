import "server-only";

export {
  getAllPlayers,
  getCurrentPlayer,
  getPlayerById,
  getPlayerRoundsById,
  getPlayerStatsById,
  getSignedInPlayer,
} from "./lib/reads";
export { isPlatformAdmin, requirePlatformAdmin } from "./lib/platform-admin";
export {
  createPlayer,
  deletePlayer,
  updatePlayer,
  type PlayerCreateInput,
  type PlayerCreateResult,
  type PlayerUpdateInput,
  type PlayerWriteResult,
} from "./lib/writes";
