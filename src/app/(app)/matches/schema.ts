import { z } from "zod";
import { matchFormatPolicy } from "@/lib/matches/formats";

export const MatchFormatSchema = z.enum([
  "singles_match_play",
  "three_ball_match_play",
  "four_ball_match_play",
]);

export const MatchBaseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
  courseHandle: z.string().trim().min(1, "Course is required"),
  format: MatchFormatSchema,
});

export const MatchFormSchema = MatchBaseSchema.extend({
  teeId: z.number().int(),
  playerIds: z.array(z.string().min(1)),
  teamOnePlayerIds: z.array(z.string().min(1)),
  teamTwoPlayerIds: z.array(z.string().min(1)),
  teamOneRoundIds: z.array(z.number().int().positive()),
  teamTwoRoundIds: z.array(z.number().int().positive()),
});

export const MatchCreateSchema = MatchFormSchema.superRefine((value, ctx) => {
  const requiredPlayerCount = matchFormatPolicy(value.format).playerCount;
  const uniquePlayerIds = new Set(value.playerIds);

  if (value.teeId <= 0) {
    ctx.addIssue({
      code: "custom",
      message: "Tee is required",
      path: ["teeId"],
    });
  }

  if (
    value.playerIds.length !== requiredPlayerCount ||
    uniquePlayerIds.size !== requiredPlayerCount
  ) {
    ctx.addIssue({
      code: "custom",
      message:
        value.format === "singles_match_play"
          ? "Singles match play requires exactly 2 players."
          : value.format === "three_ball_match_play"
            ? "Three-ball match play requires exactly 3 players."
            : "Four-ball match play requires exactly 4 players.",
      path: ["playerIds"],
    });
  }

  if (value.format !== "four_ball_match_play") return;

  const policy = matchFormatPolicy(value.format);
  const teamOneIds = new Set(value.teamOnePlayerIds);
  const teamTwoIds = new Set(value.teamTwoPlayerIds);
  const teamIds = [...value.teamOnePlayerIds, ...value.teamTwoPlayerIds];
  const selectedIds = new Set(value.playerIds);

  if (
    value.teamOnePlayerIds.length !== policy.teamSize ||
    value.teamTwoPlayerIds.length !== policy.teamSize ||
    teamOneIds.size !== policy.teamSize ||
    teamTwoIds.size !== policy.teamSize ||
    new Set(teamIds).size !== policy.playerCount ||
    teamIds.some((playerId) => !selectedIds.has(playerId))
  ) {
    ctx.addIssue({
      code: "custom",
      message:
        "Four-ball teams must split the 4 selected players into 2 teams.",
      path: ["teamOnePlayerIds"],
    });
  }
});

export const MatchUpdateSchema = MatchBaseSchema.extend({
  id: z.number().int().positive(),
  teeId: z.number().int(),
  playerIds: z.array(z.string().min(1)),
  teamOnePlayerIds: z.array(z.string().min(1)),
  teamTwoPlayerIds: z.array(z.string().min(1)),
  teamOneRoundIds: z.array(z.number().int().positive()),
  teamTwoRoundIds: z.array(z.number().int().positive()),
});

export type MatchFormValues = z.infer<typeof MatchFormSchema>;
export type MatchUpdateFormValues = z.input<typeof MatchBaseSchema>;
export type MatchFormat = z.infer<typeof MatchFormatSchema>;
export type MatchCreateValues = z.infer<typeof MatchCreateSchema>;
export type MatchUpdateValues = z.infer<typeof MatchUpdateSchema>;
