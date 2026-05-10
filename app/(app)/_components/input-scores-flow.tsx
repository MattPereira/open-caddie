"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "@/components/reui/stepper";
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

const STEPS = [
  { value: 1, label: "Setup" },
  { value: 2, label: "Scores" },
  { value: 3, label: "Summary" },
] as const;

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
      <Stepper
        value={activeStep}
        className="w-full"
        indicators={{
          completed: (
            <HugeiconsIcon icon={Tick02Icon} size={14} strokeWidth={2} />
          ),
        }}
      >
        <StepperNav>
          {STEPS.map((step, index) => (
            <StepperItem
              key={step.value}
              step={step.value}
              className="relative flex-1 items-start"
            >
              <StepperTrigger
                asChild
                className="flex flex-col items-center gap-2.5"
              >
                <StepperIndicator>{step.value}</StepperIndicator>
                <StepperTitle>{step.label}</StepperTitle>
              </StepperTrigger>

              {STEPS.length > index + 1 ? (
                <StepperSeparator className="group-data-[state=completed]/step:bg-primary absolute inset-x-0 top-3 left-[calc(50%+0.875rem)] m-0 group-data-[orientation=horizontal]/stepper-nav:w-[calc(100%-2rem+0.225rem)] group-data-[orientation=horizontal]/stepper-nav:flex-none" />
              ) : null}
            </StepperItem>
          ))}
        </StepperNav>
      </Stepper>

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
