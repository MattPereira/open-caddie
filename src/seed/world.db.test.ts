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

  it("seeds 20 Players, six Courses and two Clubs sharing Members", async () => {
    await seedWorld();

    expect(await getAllPlayers()).toHaveLength(20);
    const courses = await getAllCourses();
    expect(courses).toHaveLength(6);
    expect(await getAllClubsFull()).toHaveLength(2);

    const mafia = await getClubMembersByHandle("mulligan-mafia");
    const hustlers = await getClubMembersByHandle("handicap-hustlers");
    const mafiaIds = new Set(mafia.map((m) => m.id));
    expect(hustlers.filter((m) => mafiaIds.has(m.id)).length).toBeGreaterThan(
      1,
    );
  });

  it("gives Mulligan Mafia a Past Season and a Current Season with Standings", async () => {
    await seedWorld();

    const club = required(await getClubByHandle("mulligan-mafia"), "club");
    expect(await getClubSeasonNumbers(club.id)).toEqual([1, 2]);
    expect((await standings("mulligan-mafia", 1)).players).toHaveLength(12);
    expect((await standings("mulligan-mafia", 2)).players).toHaveLength(13);
  });

  it("puts two Players level on points in Handicap Hustlers' Standings", async () => {
    await seedWorld();

    const { players } = await standings("handicap-hustlers", 1);
    const total = async (name: string) => {
      const id = await playerId(name);
      return required(
        players.find((p) => p.playerId === id),
        `${name}'s standing`,
      ).points.total;
    };
    expect(await total("Vijay Swing")).toBe(await total("Max Bogey"));
  });

  it("seeds a Tournament whose Skins have dead holes and one Player winning several", async () => {
    await seedWorld();

    const tournament = required(
      (await getTournamentsByClubHandle("mulligan-mafia")).find(
        (t) => t.courseHandle === "bethpage-black",
      ),
      "Bethpage Tournament",
    );
    const { rounds } = await getTournamentRounds(tournament.id);
    const skins = tournamentSkins(rounds);
    expect(skins).toHaveLength(12);
    const skinsByPlayer = Map.groupBy(skins, (skin) => skin.round.playerId);
    const philSkins = skinsByPlayer.get(await playerId("Phil Nickelson")) ?? [];
    expect(philSkins).toHaveLength(4);
  });

  it("starts a Player with one prior Tournament Round off scratch", async () => {
    await seedWorld();

    const tournament = required(
      (await getTournamentsByClubHandle("mulligan-mafia")).find(
        (t) => t.courseHandle === "tpc-sawgrass" && t.season === 2,
      ),
      "today's Sawgrass Tournament",
    );
    const { rounds } = await getTournamentRounds(tournament.id);
    const rickieId = await playerId("Rickie Fowleri");
    const rickie = required(
      rounds.find((r) => r.playerId === rickieId),
      "Rickie's round",
    );
    expect(rickie.playingHandicap).toBe(0);
  });

  it("seeds a Four-Ball whose Match Skins carry over", async () => {
    await seedWorld();

    const { course, rounds } = await matchRounds(
      "four_ball_match_play",
      "tpc-sawgrass",
    );
    const skins = scoreMatchSkins(rounds, course.holes);
    if (skins.status !== "ready") throw new Error("skins unavailable");
    const rickieId = await playerId("Rickie Fowleri");
    const rickie = required(
      rounds.find((r) => r.playerId === rickieId),
      "Rickie's round",
    );
    const sixth = required(
      skins.holes.find((h) => h.hole === 6),
      "hole 6",
    );
    expect(sixth.skinsAwarded).toBe(4);
    expect(sixth.winningRoundId).toBe(rickie.id);
  });

  it("leaves one Three-Ball Round without a Player Index Override, on another tee", async () => {
    await seedWorld();

    const { rounds } = await matchRounds("three_ball_match_play", "mauna-kea");
    const collin = await playerId("Collin Mulligan");
    const [without] = rounds.filter((r) => r.playerIndexOverride === null);
    expect(without.playerId).toBe(collin);
    expect(new Set(rounds.map((r) => r.teeId)).size).toBe(2);
  });

  it("lists a route for every Tournament, Match and Course it seeds", async () => {
    const paths = (await seedWorld()).map((route) => route.path);

    const tournaments = [
      ...(await getTournamentsByClubHandle("mulligan-mafia")),
      ...(await getTournamentsByClubHandle("handicap-hustlers")),
    ];
    for (const { id } of tournaments)
      expect(paths).toContain(`/tournaments/${id}`);
    for (const { id } of await getAllMatches())
      expect(paths).toContain(`/matches/${id}`);
    for (const { handle } of await getAllCourses())
      expect(paths).toContain(`/courses/${handle}`);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("refuses a database that already has Players", async () => {
    await seedWorld();

    await expect(seedWorld()).rejects.toThrow("already has Players");
  });
});
