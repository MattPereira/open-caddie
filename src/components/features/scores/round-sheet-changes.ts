import type {
  RoundScorecardChangesValues,
  RoundSettingsValues,
  RoundSheetFormValues,
} from "@/app/(app)/rounds/schema";

type ScoreChange = RoundScorecardChangesValues["scores"][number];
type GreenieChange = RoundScorecardChangesValues["greenies"][number];
type SheetGreenie = RoundSheetFormValues["greenies"][number];

const toStored = (value: number | "") => (value === "" ? null : value);

/**
 * What the round-page sheet must send: only the holes, fields and Greenies the
 * user changed, so a concurrent Scorer's entries elsewhere on the card survive.
 * Settings go only from someone who can manage the Round.
 */
export function toRoundSheetChanges(
  initial: RoundSheetFormValues,
  values: RoundSheetFormValues,
  { canManage }: { canManage: boolean },
): {
  scorecard: RoundScorecardChangesValues | null;
  settings: RoundSettingsValues | null;
} {
  const initialScores = new Map(initial.scores.map((s) => [s.hole, s]));
  const scores: ScoreChange[] = [];
  for (const score of values.scores) {
    const before = initialScores.get(score.hole);
    const change: ScoreChange = { hole: score.hole };
    if (score.strokes !== (before?.strokes ?? "")) {
      change.strokes = toStored(score.strokes);
    }
    if (score.putts !== (before?.putts ?? "")) {
      change.putts = toStored(score.putts);
    }
    if (change.strokes !== undefined || change.putts !== undefined) {
      scores.push(change);
    }
  }

  const initialGreenies = new Map(initial.greenies.map((g) => [g.hole, g]));
  const greenies: GreenieChange[] = [];
  for (const greenie of values.greenies) {
    const before = greenieDistance(initialGreenies.get(greenie.hole));
    const after = greenieDistance(greenie);
    const same =
      before?.feet === after?.feet && before?.inches === after?.inches;
    if (!same) greenies.push({ hole: greenie.hole, distance: after });
  }

  const settings: RoundSettingsValues = { roundId: values.roundId };
  if (canManage) {
    if (values.teeId !== initial.teeId) settings.teeId = values.teeId;
    if (values.playerIndexOverride !== initial.playerIndexOverride) {
      settings.playerIndexOverride = values.playerIndexOverride;
    }
  }
  const settingsChanged =
    settings.teeId !== undefined || settings.playerIndexOverride !== undefined;

  return {
    scorecard:
      scores.length > 0 || greenies.length > 0
        ? { roundId: values.roundId, scores, greenies }
        : null,
    settings: settingsChanged ? settings : null,
  };
}

// A row counts as a recorded Greenie only once it's an upsert with both parts
// of the distance filled in; everything else on the sheet means "none".
function greenieDistance(greenie: SheetGreenie | undefined) {
  if (
    greenie?.action !== "upsert" ||
    greenie.feet === "" ||
    greenie.inches === ""
  ) {
    return null;
  }
  return { feet: greenie.feet, inches: greenie.inches };
}
