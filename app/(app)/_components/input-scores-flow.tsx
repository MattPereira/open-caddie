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
        <RoundScoresForm
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
    <section className="flex w-full max-w-md flex-col gap-4">
      <RoundSetupForm
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
