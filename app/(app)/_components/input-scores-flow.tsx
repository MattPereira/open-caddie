"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  RoundConfigForm,
  type CourseOption,
  type TournamentOption,
} from "./round-config-form";
import { RoundScoringForm } from "./round-scoring-form";
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

type View = "config" | "scoring";

export function InputScoresFlow({
  defaultDateIso,
  courses,
  tournaments,
  activeRound,
}: InputScoresFlowProps) {
  const router = useRouter();
  const [view, setView] = useState<View>(activeRound ? "scoring" : "config");

  const goHome = () => router.push("/");

  if (view === "scoring" && activeRound) {
    return (
      <section className="flex w-full max-w-md flex-1 flex-col">
        <RoundScoringForm
          roundId={activeRound.roundId}
          round={activeRound.tableRound}
          holes={activeRound.holes}
          onBackToHome={goHome}
          onAbandoned={goHome}
        />
      </section>
    );
  }

  return (
    <section className="flex w-full max-w-md flex-col gap-6">
      <h1 className="text-center text-2xl font-medium tracking-normal text-foreground sm:text-3xl">
        Start round
      </h1>
      <RoundConfigForm
        courses={courses}
        tournaments={tournaments}
        defaultDateIso={defaultDateIso}
        onCancel={goHome}
        onCreated={() => {
          setView("scoring");
          router.refresh();
        }}
      />
    </section>
  );
}
