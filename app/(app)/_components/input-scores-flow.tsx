"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  RoundSetupForm,
  type CourseOption,
  type TournamentOption,
} from "./round-setup-form";
import { RoundScoresForm } from "./round-scores-form";
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

  const goHome = () => router.push("/");

  return (
    <section className="flex w-full max-w-md flex-1 flex-col gap-6">
      {activeStep !== 1 && activeRound ? (
        <RoundScoresForm
          roundId={activeRound.roundId}
          round={activeRound.tableRound}
          holes={activeRound.holes}
          activeStep={activeStep === 3 ? 3 : 2}
          onShowScores={() => setActiveStep(2)}
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
