import type { MatchFormat } from "@/db/schema";

const FORMATS = {
  singles_match_play: {
    label: "Head-to-Head",
    playerCount: 2,
    allowance: 1,
    teamCount: 2,
    teamSize: 1,
  },
  three_ball_match_play: {
    label: "Three-Ball",
    playerCount: 3,
    allowance: 1,
    teamCount: 3,
    teamSize: 1,
  },
  four_ball_match_play: {
    label: "Four-Ball",
    playerCount: 4,
    allowance: 0.9,
    teamCount: 2,
    teamSize: 2,
  },
} as const satisfies Record<
  MatchFormat,
  {
    label: string;
    playerCount: number;
    allowance: number;
    teamCount: number;
    teamSize: number;
  }
>;

/** Creation/scoring require this player count; editing Singles/Three-Ball only caps it. */
export function matchFormatPolicy(format: MatchFormat) {
  return FORMATS[format];
}

export function matchFormatLabel(format: MatchFormat | null | undefined) {
  return format ? FORMATS[format].label : null;
}
