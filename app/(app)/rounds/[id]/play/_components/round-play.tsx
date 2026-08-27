"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { RoundScoresTableRound } from "@/components/features/scores/round-scores-card";
import type { StoredMatchPlayTeam } from "@/app/(app)/matches/[id]/_components/match-play-tab-content";
import type { MatchFormat } from "@/app/(app)/matches/schema";
import { RoundScoresForm, type SettingsTee } from "./round-scores-form";
import {
  buildInitialScores,
  buildLiveRound,
  type ScoreEntry,
} from "./round-score-state";
import { useDelegateRoundIds } from "./use-delegate-round-id";

export type ScoringPeer = {
  roundId: number;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  scores: {
    hole: number;
    par: number | null;
    strokes: number | null;
    putts: number | null;
  }[];
  greenies: { hole: number; feet: number; inches: number }[];
};

export type MatchScoreboard = {
  format: MatchFormat;
  rounds: RoundScoresTableRound[];
  teams: StoredMatchPlayTeam[];
};

type RoundPlayProps = {
  roundId: number;
  tableRound: RoundScoresTableRound;
  leaderboardRounds?: RoundScoresTableRound[];
  holes: {
    hole: number;
    par: number;
    handicap?: number | null;
    yards: number | null;
  }[];
  tees: SettingsTee[];
  scoringPeers: ScoringPeer[];
  matchScoreboard: MatchScoreboard | null;
};

export function RoundPlay({
  roundId,
  tableRound,
  leaderboardRounds,
  holes,
  tees,
  scoringPeers,
  matchScoreboard,
}: RoundPlayProps) {
  const router = useRouter();
  const initialScores = useMemo(
    () => buildInitialScores(tableRound.scores, holes),
    [tableRound.scores, holes],
  );
  const [scores, setScores] = useState<ScoreEntry[]>(initialScores);
  const liveRound = useMemo(
    () => buildLiveRound(tableRound, scores),
    [tableRound, scores],
  );
  const [delegateRoundIds, setDelegateRoundIds] = useDelegateRoundIds(roundId);

  const summary =
    tableRound.tournamentId != null
      ? {
          label: "View tournament",
          href: `/tournaments/${tableRound.tournamentId}`,
        }
      : tableRound.matchId != null
        ? { label: "View match", href: `/matches/${tableRound.matchId}` }
        : { label: "Round summary", href: `/rounds/${roundId}` };

  return (
    <RoundScoresForm
      roundId={roundId}
      round={liveRound}
      leaderboardRounds={leaderboardRounds}
      holes={holes}
      scores={scores}
      setScoresAction={setScores}
      tees={tees}
      scoringPeers={scoringPeers}
      matchScoreboard={matchScoreboard}
      delegateRoundIds={delegateRoundIds}
      setDelegateRoundIdsAction={setDelegateRoundIds}
      onShowSummaryAction={() => router.push(summary.href)}
      summaryLabel={summary.label}
    />
  );
}
