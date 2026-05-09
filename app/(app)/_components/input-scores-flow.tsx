"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  RoundConfigForm,
  type CourseOption,
  type TournamentOption,
} from "./round-config-form";
import { RoundScoringPlaceholder } from "./round-scoring-placeholder";

export type ActiveRound = {
  roundId: number;
  courseName: string;
  date: Date | string;
  tournamentLabel: string | null;
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
  const [round, setRound] = useState<ActiveRound | null>(activeRound);

  const goHome = () => router.push("/");

  if (view === "scoring" && round) {
    return (
      <section className="flex w-full max-w-md flex-col gap-6">
        <RoundScoringPlaceholder
          roundId={round.roundId}
          summary={{
            courseName: round.courseName,
            date: round.date,
            tournamentLabel: round.tournamentLabel,
          }}
          onBackToHome={goHome}
          onAbandoned={() => {
            setRound(null);
            goHome();
          }}
        />
      </section>
    );
  }

  return (
    <section className="flex w-full max-w-md flex-col gap-6">
      <h1 className="text-center text-2xl font-medium tracking-normal text-foreground sm:text-3xl">
        Create round
      </h1>
      <RoundConfigForm
        courses={courses}
        tournaments={tournaments}
        defaultDateIso={defaultDateIso}
        onCancel={goHome}
        onCreated={({ roundId, values }) => {
          const course = courses.find((c) => c.handle === values.courseHandle);
          const tournament =
            values.tournamentId != null
              ? (tournaments.find((t) => t.id === values.tournamentId) ?? null)
              : null;
          setRound({
            roundId,
            courseName: course?.name ?? "",
            date: values.date,
            tournamentLabel: tournament
              ? `${tournament.clubName}${tournament.season ? ` · Season ${tournament.season}` : ""}`
              : null,
          });
          setView("scoring");
        }}
      />
    </section>
  );
}
