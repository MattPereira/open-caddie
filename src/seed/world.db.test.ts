import { describe, expect, it } from "vitest";

import { required } from "@/lib/required";
import {
  getAllClubsFull,
  getClubByHandle,
  getClubMembersByHandle,
} from "@/modules/clubs/server";
import { getAllCourses } from "@/modules/courses/server";
import { scoreMatchSkins } from "@/modules/matches";
import { getAllMatches } from "@/modules/matches/server";
import { getAllPlayers } from "@/modules/players/server";
import { getMatchRounds, getTournamentRounds } from "@/modules/rounds/server";
import {
  getClubSeasonNumbers,
  getSeasonStandings,
} from "@/modules/seasons/server";
import { tournamentSkins } from "@/modules/tournaments";
import { getTournamentsByClubHandle } from "@/modules/tournaments/server";
import { seedWorld } from "./world";

// Runs the seed `pnpm db:seed` runs, so a module change that breaks it fails
// here rather than in the next agent run.
describe("seedWorld", () => {
  async function matchRounds(format: string, courseHandle: string) {
    const match = required(
      (await getAllMatches()).find(
        (m) => m.format === format && m.courseHandle === courseHandle,
      ),
      `${format} at ${courseHandle}`,
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

  async function standings(clubHandle: string, season: number) {
    const club = required(await getClubByHandle(clubHandle), clubHandle);
    return required(
      await getSeasonStandings({ clubId: club.id, season }),
      `${clubHandle} Season ${season}`,
    );
  }

  it("seeds a fuller world: Players, 18-hole Courses and two Clubs sharing Members", async () => {
    await seedWorld();

    expect(await getAllPlayers()).toHaveLength(20);
    const courses = await getAllCourses();
    expect(courses).toHaveLength(6);
    expect(await getAllClubsFull()).toHaveLength(2);

    const saturday = await getClubMembersByHandle("saturday-club");
    const dawn = await getClubMembersByHandle("dawn-patrol");
    const saturdayIds = new Set(saturday.map((m) => m.id));
    expect(dawn.filter((m) => saturdayIds.has(m.id)).length).toBeGreaterThan(1);
  });

  it("gives Saturday Club a Past Season and a Current Season with Standings", async () => {
    await seedWorld();

    const club = required(await getClubByHandle("saturday-club"), "club");
    expect(await getClubSeasonNumbers(club.id)).toEqual([1, 2]);
    expect((await standings("saturday-club", 1)).players).toHaveLength(12);
    expect((await standings("saturday-club", 2)).players).toHaveLength(13);
  });

  it("puts two Players level on points in Dawn Patrol's Standings", async () => {
    await seedWorld();

    const { players } = await standings("dawn-patrol", 1);
    const total = async (name: string) => {
      const id = await playerId(name);
      return required(
        players.find((p) => p.playerId === id),
        `${name}'s standing`,
      ).points.total;
    };
    expect(await total("Siobhán Ó Ceallaigh")).toBe(
      await total("Leo Castellanos"),
    );
  });

  it("seeds a Tournament whose Skins have dead holes and one Player winning several", async () => {
    await seedWorld();

    const tournament = required(
      (await getTournamentsByClubHandle("saturday-club")).find(
        (t) => t.courseHandle === "brackenmoor-heath",
      ),
      "Brackenmoor Tournament",
    );
    const { rounds } = await getTournamentRounds(tournament.id);
    const skins = tournamentSkins(rounds);
    expect(skins.length).toBeLessThan(18);
    const skinsByPlayer = Map.groupBy(skins, (skin) => skin.round.playerId);
    const noorSkins = skinsByPlayer.get(await playerId("Noor Haddad")) ?? [];
    expect(noorSkins.length).toBeGreaterThanOrEqual(3);
  });

  it("seeds a Four-Ball whose Match Skins carry over", async () => {
    await seedWorld();

    const { course, rounds } = await matchRounds(
      "four_ball_match_play",
      "saguaro-ridge",
    );
    const skins = scoreMatchSkins(rounds, course.holes);
    if (skins.status !== "ready") throw new Error("skins unavailable");
    const mayaId = await playerId("Maya Thornbury");
    const maya = required(
      rounds.find((r) => r.playerId === mayaId),
      "Maya's round",
    );
    const sixth = required(
      skins.holes.find((h) => h.hole === 6),
      "hole 6",
    );
    expect(sixth.skinsAwarded).toBe(4);
    expect(sixth.winningRoundId).toBe(maya.id);
  });

  it("leaves one Three-Ball Round without a Player Index Override, on another tee", async () => {
    await seedWorld();

    const { rounds } = await matchRounds("three_ball_match_play", "port-haven");
    const wilhelmina = await playerId(
      "Wilhelmina Featherstonehaugh-Montgomery",
    );
    const [without] = rounds.filter((r) => r.playerIndexOverride === null);
    expect(without.playerId).toBe(wilhelmina);
    expect(new Set(rounds.map((r) => r.teeId)).size).toBe(2);
  });

  it("refuses a database that already has Players", async () => {
    await seedWorld();

    await expect(seedWorld()).rejects.toThrow("already has Players");
  });
});
