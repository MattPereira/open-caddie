import type { DisplayRound } from "./display-round-reads";

/** Every Greenie of the Rounds, closest first within a hole. */
export function eventGreenies(rounds: readonly DisplayRound[]) {
  return rounds
    .flatMap((round) => round.greenies)
    .sort(
      (a, b) =>
        a.hole - b.hole ||
        a.feet * 12 + a.inches - (b.feet * 12 + b.inches),
    );
}
