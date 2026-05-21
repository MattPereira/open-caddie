import { z } from "zod";

export const MatchFormatSchema = z.enum([
  "singles_match_play",
  "four_ball_match_play",
]);

export const MatchBaseSchema = z.object({
  name: z.string().trim(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
  startsAt: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, "Start time is required"),
  courseHandle: z.string().trim().min(1, "Course is required"),
  format: MatchFormatSchema,
});

export const MatchFormSchema = MatchBaseSchema.extend({
  teeId: z.number().int(),
  playerUserIds: z.array(z.string().min(1)),
  teamOneUserIds: z.array(z.string().min(1)),
  teamTwoUserIds: z.array(z.string().min(1)),
  teamOneRoundIds: z.array(z.number().int().positive()),
  teamTwoRoundIds: z.array(z.number().int().positive()),
});

export const MatchCreateSchema = MatchFormSchema.superRefine((value, ctx) => {
  const requiredPlayerCount =
    value.format === "singles_match_play" ? 2 : 4;
  const uniquePlayerIds = new Set(value.playerUserIds);

  if (value.teeId <= 0) {
    ctx.addIssue({
      code: "custom",
      message: "Tee is required",
      path: ["teeId"],
    });
  }

  if (
    value.playerUserIds.length !== requiredPlayerCount ||
    uniquePlayerIds.size !== requiredPlayerCount
  ) {
    ctx.addIssue({
      code: "custom",
      message:
        value.format === "singles_match_play"
          ? "Singles match play requires exactly 2 players."
          : "Four-ball match play requires exactly 4 players.",
      path: ["playerUserIds"],
    });
  }

  if (value.format === "singles_match_play") return;

  const teamOneIds = new Set(value.teamOneUserIds);
  const teamTwoIds = new Set(value.teamTwoUserIds);
  const teamIds = [...value.teamOneUserIds, ...value.teamTwoUserIds];
  const selectedIds = new Set(value.playerUserIds);

  if (
    value.teamOneUserIds.length !== 2 ||
    value.teamTwoUserIds.length !== 2 ||
    teamOneIds.size !== 2 ||
    teamTwoIds.size !== 2 ||
    new Set(teamIds).size !== 4 ||
    teamIds.some((userId) => !selectedIds.has(userId))
  ) {
    ctx.addIssue({
      code: "custom",
      message: "Four-ball teams must split the 4 selected players into 2 teams.",
      path: ["teamOneUserIds"],
    });
  }
});

export const MatchUpdateSchema = MatchBaseSchema.extend({
  id: z.number().int().positive(),
  teamOneRoundIds: z.array(z.number().int().positive()),
  teamTwoRoundIds: z.array(z.number().int().positive()),
});

export type MatchFormValues = z.infer<typeof MatchFormSchema>;
export type MatchUpdateFormValues = z.input<typeof MatchBaseSchema>;
export type MatchFormat = z.infer<typeof MatchFormatSchema>;
export type MatchCreateValues = z.infer<typeof MatchCreateSchema>;
export type MatchUpdateValues = z.infer<typeof MatchUpdateSchema>;
