import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { readScorecardsByRounds } from "../scorecards";
import { createRoundFixtures } from "../test-fixtures";
import { importRoundScorecard } from "./index";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));

// The AI parser stays out of the test: it reads back every selected Round with
// a 4 on each hole, as if the card were filled in that way.
vi.mock("./parser", () => ({
  parseRoundScorecardImage: vi.fn(
    async (
      _image: Buffer,
      _mediaType: string,
      context: { rounds: { roundId: number }[] },
    ) => ({
      parsed: {
        rounds: context.rounds.map(({ roundId }) => ({
          roundId,
          holes: Array.from({ length: 18 }, (_, index) => ({
            hole: index + 1,
            strokes: 4,
          })),
        })),
      },
      sumChecks: [],
    }),
  ),
}));

describe("Round Scorecard Import", () => {
  const fixtures = createRoundFixtures(db, schema);

  const IMAGE_URL =
    "https://example.public.blob.vercel-storage.com/round-scorecards/card.jpg";

  function cardFor(roundIds: number[]) {
    const formData = new FormData();
    formData.set("scorecardImgUrl", IMAGE_URL);
    for (const roundId of roundIds) {
      formData.append("roundId", String(roundId));
    }
    return formData;
  }

  async function importAs(
    playerId: string,
    event: { kind: "tournament" | "match"; id: number },
    roundIds: number[],
  ) {
    return importRoundScorecard({
      playerId,
      eventKind: event.kind,
      eventId: event.id,
      formData: cardFor(roundIds),
    });
  }

  async function strokesOf(roundId: number) {
    const { scores } = await readScorecardsByRounds(
      eq(schema.rounds.id, roundId),
    );
    return scores.filter((score) => score.strokes != null).length;
  }

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new Uint8Array([1, 2, 3]), {
            headers: { "content-type": "image/jpeg" },
          }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lets a Pairing mate import their Pairing's Rounds", async () => {
    const t = await fixtures.tournament();
    const marker = await fixtures.tournamentPlayer(t);
    const mate = await fixtures.tournamentPlayer(t);
    await fixtures.pairing(t.tournament.id, [marker.round.id, mate.round.id]);

    const result = await importAs(
      marker.player.id,
      { kind: "tournament", id: t.tournament.id },
      [marker.round.id, mate.round.id],
    );

    expect(result).toEqual({
      ok: true,
      redirectPath: `/tournaments/${t.tournament.id}?tab=rounds`,
    });
    expect(await strokesOf(marker.round.id)).toBe(18);
    expect(await strokesOf(mate.round.id)).toBe(18);
  });

  it("writes nothing and reports not found when a Round is outside the uploader's Pairing", async () => {
    const t = await fixtures.tournament();
    const marker = await fixtures.tournamentPlayer(t);
    const mate = await fixtures.tournamentPlayer(t);
    const outsider = await fixtures.tournamentPlayer(t);
    await fixtures.pairing(t.tournament.id, [marker.round.id, mate.round.id]);
    await fixtures.pairing(t.tournament.id, [outsider.round.id]);

    const result = await importAs(
      marker.player.id,
      { kind: "tournament", id: t.tournament.id },
      [marker.round.id, mate.round.id, outsider.round.id],
    );

    expect(result).toEqual({ ok: false, error: "Round not found." });
    expect(await strokesOf(marker.round.id)).toBe(0);
    expect(await strokesOf(mate.round.id)).toBe(0);
    expect(await strokesOf(outsider.round.id)).toBe(0);
  });

  it("lets a Match creator who isn't playing import the Match's Rounds", async () => {
    const { match, creator, players } = await fixtures.match(2, {
      creatorPlays: false,
    });
    const roundIds = players.map((player) => player.round.id);

    const result = await importAs(
      creator.id,
      { kind: "match", id: match.id },
      roundIds,
    );

    expect(result).toEqual({
      ok: true,
      redirectPath: `/matches/${match.id}?tab=rounds`,
    });
    for (const roundId of roundIds) {
      expect(await strokesOf(roundId)).toBe(18);
    }
  });
});
