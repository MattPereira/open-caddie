"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { RoundScoresTableRound } from "@/components/round-scores-card";
import { RoundScoresForm, type SettingsTee } from "./round-scores-form";
import {
  buildInitialScores,
  buildLiveRound,
  type ScoreEntry,
} from "./round-score-state";
import { useDelegateRoundId } from "./use-delegate-round-id";

export type MatchPlayer = {
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

type RoundPlayProps = {
  roundId: number;
  tableRound: RoundScoresTableRound;
  leaderboardRounds?: RoundScoresTableRound[];
  date: Date | string;
  holes: { hole: number; par: number; yards: number | null }[];
  tees: SettingsTee[];
  matchPlayers: MatchPlayer[];
};

export function RoundPlay({
  roundId,
  tableRound,
  leaderboardRounds,
  date,
  holes,
  tees,
  matchPlayers,
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
  const [delegateRoundId, setDelegateRoundId] = useDelegateRoundId(roundId);

  return (
    <RoundScoresForm
      roundId={roundId}
      round={liveRound}
      leaderboardRounds={leaderboardRounds}
      date={date}
      holes={holes}
      scores={scores}
      setScores={setScores}
      tees={tees}
      matchPlayers={matchPlayers}
      delegateRoundId={delegateRoundId}
      setDelegateRoundId={setDelegateRoundId}
      onShowSummary={() => router.push(`/rounds/${roundId}`)}
      onAbandoned={() => router.push("/")}
    />
  );
}
