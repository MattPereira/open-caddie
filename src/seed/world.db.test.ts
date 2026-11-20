import { describe, expect, it } from "vitest";

import { required } from "@/lib/required";
import { getClubByHandle } from "@/modules/clubs/server";
import { scoreMatchSkins } from "@/modules/matches";
import { getAllMatches } from "@/modules/matches/server";
import { getAllPlayers } from "@/modules/players/server";
import { getMatchRounds } from "@/modules/rounds/server";
import { getSeasonStandings } from "@/modules/seasons/server";
import { seedWorld } from "./world";

// Runs the seed `pnpm db:seed` runs, so a module change that breaks it fails
// here rather than in the next agent run.
describe("seedWorld", () => {
  async function matchRounds(format: string) {
    const match = required(
      (await getAllMatches()).find((m) => m.format === format),
      format,
    );
    return getMatchRounds(match.id);
  }

  async function playerId(name: string) {
    return required(
      (await getAllPlayers()).find(
        (p) => `${p.firstName} ${p.lastName}` === name,
      ),
      name,
    ).id;
  }

  it("seeds Players and a Club whose Standings have every Club Member who played", async () => {
    await seedWorld();

    expect(await getAllPlayers()).toHaveLength(9);
    const club = required(await getClubByHandle("saturday-club"), "club");
    const standings = required(
      await getSeasonStandings({ clubId: club.id, season: 1 }),
      "standings",
    );
    expect(standings.players).toHaveLength(8);
  });

  it("seeds a Four-Ball whose Match Skins carry over", async () => {
    await seedWorld();

    const { course, rounds } = await matchRounds("four_ball_match_play");
    const skins = scoreMatchSkins(rounds, course.holes);
    if (skins.status !== "ready") throw new Error("skins unavailable");
    const jordanId = await playerId("Jordan Spieth");
    const jordan = required(
      rounds.find((r) => r.playerId === jordanId),
      "Jordan's round",
    );
    const sixth = required(
      skins.holes.find((h) => h.hole === 6),
      "hole 6",
    );
    expect(sixth.skinsAwarded).toBe(4);
    expect(sixth.winningRoundId).toBe(jordan.id);
  });

  it("leaves one Three-Ball Round without a Player Index Override, on another tee", async () => {
    await seedWorld();

    const { rounds } = await matchRounds("three_ball_match_play");
    const christiaan = await playerId("Christiaan Bezuidenhout");
    const [without] = rounds.filter((r) => r.playerIndexOverride === null);
    expect(without.playerId).toBe(christiaan);
    expect(new Set(rounds.map((r) => r.teeId)).size).toBe(2);
  });

  it("refuses a database that already has Players", async () => {
    await seedWorld();

    await expect(seedWorld()).rejects.toThrow("already has Players");
  });
});
