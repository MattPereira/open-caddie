"use client";

import { useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import type { RoundScoresTableRound } from "@/components/features/scores/round-scores-card";
import type { CourseHole, DisplayRound } from "@/lib/rounds/reads";
import type { MatchScoreboard } from "./live-scores";
import { RoundScoresForm, type SettingsTee } from "./round-scores-form";
import { MAX_DELEGATES } from "./settings-dialog";
import { useDelegateRoundIds } from "./use-delegate-round-id";

/** A Round on the play page: a column, a leaderboard row or a scoreboard player. */
export type PlayRound = RoundScoresTableRound &
  Pick<DisplayRound, "kind" | "userId" | "teeId" | "yards">;

/** The event the played Round belongs to, or null for a casual Round. */
export type PlayEvent = { kind: "tournament" | "match"; id: number } | null;

export type PlayCourse = {
  name: string;
  holes: CourseHole[];
  tees: SettingsTee[];
};

type RoundPlayProps = {
  currentUserId: string;
  round: PlayRound;
  event: PlayEvent;
  course: PlayCourse;
  leaderboardRounds?: PlayRound[];
  scorableRounds: PlayRound[];
  // Selected on first open of this Round's play form, so a player keeping their
  // Pairing's card finds their mates already there.
  prefillDelegateRoundIds?: readonly number[];
  canManage: boolean;
  matchScoreboard: MatchScoreboard<PlayRound> | null;
  courseRecords: ReactNode;
};

export function RoundPlay({
  currentUserId,
  round,
  event,
  course,
  leaderboardRounds,
  scorableRounds,
  prefillDelegateRoundIds,
  canManage,
  matchScoreboard,
  courseRecords,
}: RoundPlayProps) {
  const router = useRouter();
  const roundId = round.id;
  // A Pairing holds at most four Rounds, so a player's mates already fit the
  // picker's cap; the slice keeps a prefill from ever exceeding what the picker
  // would let the player choose by hand.
  const prefill = useMemo(
    () => prefillDelegateRoundIds?.slice(0, MAX_DELEGATES),
    [prefillDelegateRoundIds],
  );
  const [delegateRoundIds, setDelegateRoundIds] = useDelegateRoundIds(
    roundId,
    prefill,
  );

  const summary =
    event?.kind === "tournament"
      ? { label: "View tournament", href: `/tournaments/${event.id}` }
      : event?.kind === "match"
        ? { label: "View match", href: `/matches/${event.id}` }
        : { label: "Round summary", href: `/rounds/${roundId}` };

  return (
    <RoundScoresForm
      currentUserId={currentUserId}
      round={round}
      event={event}
      course={course}
      leaderboardRounds={leaderboardRounds}
      scorableRounds={scorableRounds}
      canManage={canManage}
      matchScoreboard={matchScoreboard}
      delegateRoundIds={delegateRoundIds}
      setDelegateRoundIdsAction={setDelegateRoundIds}
      onShowSummaryAction={() => router.push(summary.href)}
      summaryLabel={summary.label}
      courseRecords={courseRecords}
    />
  );
}
