"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeftBigIcon,
  ArrowRightBigIcon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { deleteRound, upsertRoundScore } from "../actions";
import { HoleScoreSlide } from "./hole-score-slide";
import {
  RoundScoresCard,
  toRoundScoreRow,
  type RoundScoresTableRound,
} from "@/components/round-scores-card";
import { calculateNetStrokes } from "@/lib/scoring";
import { RoundSummary } from "./round-summary";

type ScoreEntry = {
  hole: number;
  par: number | null;
  strokes: number | null;
  putts: number | null;
};

type RoundScoresFormProps = {
  roundId: number;
  round: RoundScoresTableRound;
  holes: { hole: number; par: number }[];
  activeStep: 2 | 3;
  onShowScores: () => void;
  onShowSummary: () => void;
  onBackToHome: () => void;
  onAbandoned: () => void;
};

const HOLE_NUMBERS = Array.from({ length: 18 }, (_, i) => i + 1);

function buildInitialScores(
  roundScores: RoundScoresTableRound["scores"],
  holes: { hole: number; par: number }[],
): ScoreEntry[] {
  const scoreByHole = new Map(roundScores.map((s) => [s.hole, s]));
  const parByHole = new Map(holes.map((h) => [h.hole, h.par]));
  return HOLE_NUMBERS.map((hole) => {
    const existing = scoreByHole.get(hole);
    return {
      hole,
      par: existing?.par ?? parByHole.get(hole) ?? null,
      strokes: existing?.strokes ?? null,
      putts: existing?.putts ?? null,
    };
  });
}

export function RoundScoresForm({
  roundId,
  round,
  holes,
  activeStep,
  onShowScores,
  onShowSummary,
  onBackToHome,
  onAbandoned,
}: RoundScoresFormProps) {
  const router = useRouter();
  const initialScores = useMemo(
    () => buildInitialScores(round.scores, holes),
    [round.scores, holes],
  );
  const initialHoleIndex = useMemo(() => {
    const idx = initialScores.findIndex((s) => s.strokes == null);
    return idx === -1 ? initialScores.length - 1 : idx;
  }, [initialScores]);
  const [scores, setScores] = useState<ScoreEntry[]>(initialScores);
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [current, setCurrent] = useState(initialHoleIndex);
  const didJumpRef = useRef(false);
  const saveVersionRef = useRef<Record<number, number>>({});
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, startSaveTransition] = useTransition();

  const [confirming, setConfirming] = useState(false);
  const [abandonError, setAbandonError] = useState<string | null>(null);
  const [isAbandoning, startAbandonTransition] = useTransition();

  useEffect(() => {
    if (!api || didJumpRef.current) return;
    didJumpRef.current = true;
    if (initialHoleIndex > 0) {
      api.scrollTo(initialHoleIndex, true);
    }
  }, [api, initialHoleIndex]);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => {
      setCurrent(api.selectedScrollSnap());
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    };
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api]);

  const liveRound = useMemo<RoundScoresTableRound>(() => {
    const totalStrokes = scores.reduce((s, x) => s + (x.strokes ?? 0), 0);
    const totalPutts = scores.reduce((s, x) => s + (x.putts ?? 0), 0);
    const recordedStrokesCount = scores.filter((s) => s.strokes != null).length;
    const recordedPuttsCount = scores.filter((s) => s.putts != null).length;
    const completeTotalStrokes =
      recordedStrokesCount === HOLE_NUMBERS.length ? totalStrokes : null;
    return {
      ...round,
      totalStrokes,
      totalPutts,
      recordedStrokesCount,
      recordedPuttsCount,
      netStrokes:
        round.tournamentHandicap == null
          ? null
          : calculateNetStrokes(completeTotalStrokes, round.tournamentHandicap),
      scores: scores.map(({ hole, par, strokes, putts }) => ({
        hole,
        par,
        strokes,
        putts,
      })),
    };
  }, [round, scores]);
  const isComplete = liveRound.recordedStrokesCount === HOLE_NUMBERS.length;

  useEffect(() => {
    if (activeStep === 3 && !isComplete) {
      onShowScores();
    }
  }, [activeStep, isComplete, onShowScores]);

  const handleSave = (
    hole: number,
    patch: { strokes: number | null; putts: number | null },
  ) => {
    const previousEntry = scores.find((s) => s.hole === hole) ?? null;
    const saveVersion = (saveVersionRef.current[hole] ?? 0) + 1;
    saveVersionRef.current[hole] = saveVersion;

    setSaveError(null);
    setScores((prev) =>
      prev.map((s) => (s.hole === hole ? { ...s, ...patch } : s)),
    );
    startSaveTransition(async () => {
      const result = await upsertRoundScore({ roundId, hole, ...patch });
      if (!result.ok) {
        if (saveVersionRef.current[hole] !== saveVersion) return;
        if (previousEntry) {
          setScores((prev) =>
            prev.map((s) => (s.hole === hole ? previousEntry : s)),
          );
        }
        setSaveError(result.error);
      }
    });
  };

  const handleBack = () => {
    router.refresh();
    onBackToHome();
  };

  const handleAbandon = () => {
    setAbandonError(null);
    startAbandonTransition(async () => {
      const result = await deleteRound(roundId);
      if (!result.ok) {
        setAbandonError(result.error);
        return;
      }
      onAbandoned();
    });
  };

  const currentHoleNumber = scores[current]?.hole;
  const currentHolePar = scores[current]?.par;

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-10 p-0">
      {activeStep === 2 ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-xl"
              className="rounded-full"
              disabled={!canScrollPrev}
              onClick={() => api?.scrollPrev()}
              aria-label="Previous hole"
            >
              <HugeiconsIcon
                size="lg"
                icon={ArrowLeftBigIcon}
                strokeWidth={2}
              />
            </Button>
            <div className="flex flex-col items-center gap-0 text-center text-base tabular-nums">
              <span className="text-base font-semibold">
                Hole {currentHoleNumber ?? current + 1}
              </span>
              <span className="font-medium text-muted-foreground">
                Par {currentHolePar ?? "—"}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-xl"
              className="rounded-full"
              disabled={!canScrollNext}
              onClick={() => api?.scrollNext()}
              aria-label="Next hole"
            >
              <HugeiconsIcon
                size="lg"
                icon={ArrowRightBigIcon}
                strokeWidth={2}
              />
            </Button>
          </div>

          <Carousel setApi={setApi} className="w-full min-w-0">
            <CarouselContent>
              {scores.map((entry) => (
                <CarouselItem key={entry.hole}>
                  <HoleScoreSlide
                    hole={entry.hole}
                    par={entry.par ?? 4}
                    initialStrokes={entry.strokes}
                    initialPutts={entry.putts}
                    onScoreChangeAction={(patch) =>
                      handleSave(entry.hole, patch)
                    }
                    onAdvanceHoleAction={() => api?.scrollNext()}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>

          {saveError ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {saveError}
            </p>
          ) : null}
        </>
      ) : null}

      {activeStep === 3 ? (
        <RoundSummary round={liveRound} />
      ) : (
        <>
          <RoundScoresCard
            row={toRoundScoreRow(liveRound)}
            showMobileTotals={false}
          />

          {currentHolePar === 3 ? (
            <div className="font-medium">Greenie</div>
          ) : null}
        </>
      )}

      <div className="mt-auto flex flex-col gap-3">
        {abandonError ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {abandonError}
          </p>
        ) : null}

        {confirming ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">
              Are you sure? This permanently deletes this round.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isAbandoning}
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={isAbandoning}
                onClick={handleAbandon}
              >
                {isAbandoning ? "Deleting…" : "Yes, abandon"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {activeStep === 3 ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={onShowScores}
                >
                  Back to scores
                </Button>
                {liveRound.tournamentId != null ? (
                  <Button asChild className="flex-1">
                    <Link href={`/tournaments/${liveRound.tournamentId}`}>
                      See tournament
                    </Link>
                  </Button>
                ) : null}
              </>
            ) : isComplete ? (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-lg"
                  onClick={() => setConfirming(true)}
                  aria-label="Delete round"
                >
                  <HugeiconsIcon icon={Delete02Icon} aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="ml-auto flex-1"
                  onClick={handleBack}
                >
                  Back home
                </Button>
                <Button type="button" className="flex-1" onClick={onShowSummary}>
                  See summary
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-lg"
                  onClick={() => setConfirming(true)}
                  aria-label="Delete round"
                >
                  <HugeiconsIcon icon={Delete02Icon} aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="ml-auto flex-1"
                  onClick={handleBack}
                >
                  Back home
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
