import { displayName } from "@/modules/players";
import { getPlayerById, isPlatformAdmin } from "@/modules/players/server";
import { createProblemReports } from "./filing";

const problemReports = createProblemReports({
  fetch: (input, init) => fetch(input, init),
  async findReporter(playerId) {
    const player = await getPlayerById(playerId);
    if (!player) return null;
    return {
      id: player.id,
      name: displayName(player),
      isPlatformAdmin: await isPlatformAdmin(player.id),
    };
  },
});

export const canFileProblemReport = problemReports.canFile;
export const fileProblemReport = problemReports.file;
