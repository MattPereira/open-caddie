"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useMemo,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import {
  RoundSetupForm,
  type CourseOption,
  type TournamentOption,
} from "./round-setup-form";
import {
  buildInitialScores,
  buildLiveRound,
  isRoundComplete,
  type ScoreEntry,
} from "./round-score-state";
import { RoundScoresForm } from "./round-scores-form";
import { RoundSummary } from "./round-summary";
import type { RoundScoresTableRound } from "../tournaments/[id]/_components/round-scores-table";

export type ActiveRound = {
  roundId: number;
  courseName: string;
  date: Date | string;
  tournamentLabel: string | null;
  tableRound: RoundScoresTableRound;
  holes: { hole: number; par: number }[];
};

type InputScoresFlowProps = {
  defaultDateIso: string;
  courses: CourseOption[];
  tournaments: TournamentOption[];
  activeRound: ActiveRound | null;
};

type InputScoresStep = 1 | 2 | 3;

type ScoreState = {
  roundId: number | null;
  scores: ScoreEntry[];
};

export function InputScoresFlow({
  defaultDateIso,
  courses,
  tournaments,
  activeRound,
}: InputScoresFlowProps) {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState<InputScoresStep>(
    activeRound ? 2 : 1,
  );
  const activeRoundId = activeRound?.roundId ?? null;
  const initialScores = useMemo(
    () =>
      activeRound
        ? buildInitialScores(activeRound.tableRound.scores, activeRound.holes)
        : [],
    [activeRound],
  );
  const [scoreState, setScoreState] = useState<ScoreState>({
    roundId: activeRoundId,
    scores: initialScores,
  });

  let scores = scoreState.scores;
  if (scoreState.roundId !== activeRoundId) {
    scores = initialScores;
    setScoreState({ roundId: activeRoundId, scores: initialScores });
  }

  const setScores = useCallback<Dispatch<SetStateAction<ScoreEntry[]>>>(
    (value) => {
      setScoreState((previous) => ({
        ...previous,
        scores: typeof value === "function" ? value(previous.scores) : value,
      }));
    },
    [],
  );

  const liveRound = useMemo(
    () => (activeRound ? buildLiveRound(activeRound.tableRound, scores) : null),
    [activeRound, scores],
  );
  const showSummary =
    activeStep === 3 && liveRound != null && isRoundComplete(liveRound);

  const showScoringForm = activeStep === 2 && activeRound && liveRound;

  const goHome = () => router.push("/");

  return (
    <section className="flex w-full max-w-md flex-1 flex-col justify-center gap-6">
      {showSummary ? (
        <div className="flex w-full min-w-0 flex-1 flex-col gap-10 p-0">
          <RoundSummary round={liveRound} />
          <div className="mt-auto flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              size="xl"
              onClick={() => setActiveStep(2)}
            >
              Back to scores
            </Button>
            {liveRound.tournamentId != null ? (
              <Button asChild className="flex-1" size="xl">
                <Link href={`/tournaments/${liveRound.tournamentId}`}>
                  See tournament
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : showScoringForm ? (
        <RoundScoresForm
          key={activeRound.roundId}
          roundId={activeRound.roundId}
          round={liveRound}
          holes={activeRound.holes}
          scores={scores}
          setScores={setScores}
          onShowSummary={() => setActiveStep(3)}
          onBackToHome={goHome}
          onAbandoned={goHome}
        />
      ) : (
        <RoundSetupForm
          courses={courses}
          tournaments={tournaments}
          defaultDateIso={defaultDateIso}
          onCancel={goHome}
          onCreated={() => {
            setActiveStep(2);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}
