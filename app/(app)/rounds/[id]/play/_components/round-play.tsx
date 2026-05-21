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

type RoundPlayProps = {
  roundId: number;
  tableRound: RoundScoresTableRound;
  leaderboardRounds?: RoundScoresTableRound[];
  date: Date | string;
  holes: { hole: number; par: number; yards: number | null }[];
  tees: SettingsTee[];
};

export function RoundPlay({
  roundId,
  tableRound,
  leaderboardRounds,
  date,
  holes,
  tees,
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
      onShowSummary={() => router.push(`/rounds/${roundId}`)}
      onAbandoned={() => router.push("/")}
    />
  );
}
