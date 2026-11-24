import { recordScorecardChanges } from "@/modules/rounds/server";

import { ok } from "./ok";

export type HoleScore = { strokes: number; putts: number };
export type Distance = { feet: number; inches: number };

/** The card with only its first `holes` holes scored. */
export function firstHoles(card: HoleScore[], holes: number) {
  return card.map((hole, i) => (i < holes ? hole : null));
}

/** A fixed pseudo-random digit 0–9 for a Player's hole in one Event. */
function fixedDigit(salt: number, hole: number) {
  return (Math.imul(salt * 31 + hole, 2654435761) >>> 0) % 10;
}

/**
 * A believable card: `skill` below 0 plays better, above 0 worse. `salt`
 * makes each Player's card in each Event different but fixed.
 */
export function scorecard(
  pars: number[],
  skill: number,
  salt: number,
): HoleScore[] {
  const overPar = [0, 0, 0, 1, 1, 1, 2, 2, 3];
  return pars.map((par, i) => {
    const r = fixedDigit(salt, i + 1);
    // About one birdie in ten holes, whatever the skill.
    const over =
      r === 0 ? -1 : overPar[Math.min(8, Math.max(0, r - 1 + skill))];
    const strokes = par + over;
    const putts = over < 0 || r === 4 ? 1 : r === 9 ? 3 : 2;
    return { strokes, putts: Math.min(putts, strokes - 1) };
  });
}

/** Par on the par 3s, double bogey with three putts everywhere else. */
export function strugglingCard(pars: number[]): HoleScore[] {
  return pars.map((par) =>
    par === 3 ? { strokes: 3, putts: 2 } : { strokes: par + 2, putts: 3 },
  );
}

export async function writeScores(
  adminId: string,
  roundId: number,
  card: (HoleScore | null)[],
) {
  const scores = card.flatMap((hole, i) =>
    hole ? [{ roundId, hole: i + 1, ...hole }] : [],
  );
  ok(await recordScorecardChanges(adminId, { scores }), "scores");
}

export async function writeGreenie(
  adminId: string,
  roundId: number,
  hole: number,
  distance: Distance,
) {
  ok(
    await recordScorecardChanges(adminId, {
      greenies: [{ roundId, hole, distance }],
    }),
    "greenie",
  );
}
