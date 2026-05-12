"use client";

import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft02Icon,
  Delete02Icon,
  ArrowRight02Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { CourseHero } from "@/components/course-hero";
import { HeroActionButton } from "@/components/hero-action-button";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { formatDate } from "@/lib/utils";
import {
  deleteRound,
  deleteRoundGreenie,
  upsertRoundGreenie,
  upsertRoundScore,
} from "../actions";
import { HoleScoreSlide } from "./hole-score-slide";
import {
  RoundScoresCard,
  type RoundScoresTableRound,
} from "@/components/round-scores-card";
import { toRoundScoreRow } from "@/components/round-scores-card-row";
import {
  type ScoreEntry,
  buildInitialScores,
  isRoundComplete,
} from "./round-score-state";
import { HoleGreenieManager, type GreenieValue } from "./hole-greenie-manager";

type GreenieEntry = GreenieValue & { hole: number };

type RoundScoresFormProps = {
  roundId: number;
  round: RoundScoresTableRound;
  courseImgUrl: string | null;
  date: Date | string;
  holes: { hole: number; par: number }[];
  scores: ScoreEntry[];
  setScores: Dispatch<SetStateAction<ScoreEntry[]>>;
  onShowSummary: () => void;
  onAbandoned: () => void;
};

export function RoundScoresForm({
  roundId,
  round,
  courseImgUrl,
  date,
  holes,
  scores,
  setScores,
  onShowSummary,
  onAbandoned,
}: RoundScoresFormProps) {
  const initialScores = useMemo(
    () => buildInitialScores(round.scores, holes),
    [round.scores, holes],
  );
  const initialHoleIndex = useMemo(() => {
    const idx = initialScores.findIndex((s) => s.strokes == null);
    return idx === -1 ? initialScores.length - 1 : idx;
  }, [initialScores]);
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [current, setCurrent] = useState(initialHoleIndex);
  const didJumpRef = useRef(false);
  const saveVersionRef = useRef<Record<number, number>>({});
  const greenieSaveVersionRef = useRef<Record<number, number>>({});
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, startSaveTransition] = useTransition();
  const [greenies, setGreenies] = useState<GreenieEntry[]>(
    () => round.greenies ?? [],
  );

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

  const isComplete = isRoundComplete(round);

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

  const handleGreenieSave = (hole: number, value: GreenieValue) => {
    const previousGreenie = greenies.find((g) => g.hole === hole) ?? null;
    const saveVersion = (greenieSaveVersionRef.current[hole] ?? 0) + 1;
    greenieSaveVersionRef.current[hole] = saveVersion;

    setSaveError(null);
    setGreenies((prev) => {
      const nextGreenie = { hole, ...value };
      return prev.some((g) => g.hole === hole)
        ? prev.map((g) => (g.hole === hole ? nextGreenie : g))
        : [...prev, nextGreenie].sort((a, b) => a.hole - b.hole);
    });
    startSaveTransition(async () => {
      const result = await upsertRoundGreenie({ roundId, hole, ...value });
      if (!result.ok) {
        if (greenieSaveVersionRef.current[hole] !== saveVersion) return;
        setGreenies((prev) => {
          const withoutCurrent = prev.filter((g) => g.hole !== hole);
          return previousGreenie
            ? [...withoutCurrent, previousGreenie].sort(
                (a, b) => a.hole - b.hole,
              )
            : withoutCurrent;
        });
        setSaveError(result.error);
      }
    });
  };

  const handleGreenieDelete = (hole: number) => {
    const previousGreenie = greenies.find((g) => g.hole === hole) ?? null;
    const saveVersion = (greenieSaveVersionRef.current[hole] ?? 0) + 1;
    greenieSaveVersionRef.current[hole] = saveVersion;

    setSaveError(null);
    setGreenies((prev) => prev.filter((g) => g.hole !== hole));
    startSaveTransition(async () => {
      const result = await deleteRoundGreenie({ roundId, hole });
      if (!result.ok) {
        if (greenieSaveVersionRef.current[hole] !== saveVersion) return;
        if (previousGreenie) {
          setGreenies((prev) =>
            [...prev.filter((g) => g.hole !== hole), previousGreenie].sort(
              (a, b) => a.hole - b.hole,
            ),
          );
        }
        setSaveError(result.error);
      }
    });
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
  const currentGreenie =
    currentHoleNumber != null
      ? (greenies.find((g) => g.hole === currentHoleNumber) ?? null)
      : null;

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-4 p-0 sm:flex-none">
      <div className="flex flex-col gap-4">
        <CourseHero
          courseName={round.courseName ?? null}
          courseImgUrl={courseImgUrl}
          subtitle={formatDate(date, "long")}
          action={
            <HeroActionButton
              type="button"
              onClick={() => setConfirming(true)}
              aria-label="Delete round"
            >
              <HugeiconsIcon icon={Delete02Icon} aria-hidden />
            </HeroActionButton>
          }
        />

        <RoundScoresCard
          row={toRoundScoreRow(round)}
          showMobileTotals={false}
        />
      </div>

      <div className="flex items-center justify-between gap-2 px-">
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
            icon={ArrowLeft02Icon}
            strokeWidth={2}
            className="size-6"
          />
        </Button>
        <div className="flex flex-col items-center leading-tight">
          <span className="text-lg font-medium tracking-tight">
            Hole {currentHoleNumber}
          </span>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Par {currentHolePar}
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
            icon={ArrowRight02Icon}
            strokeWidth={2}
            className="size-6"
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
                onScoreChangeAction={(patch) => handleSave(entry.hole, patch)}
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

      {currentHolePar === 3 && currentHoleNumber != null ? (
        <HoleGreenieManager
          key={currentHoleNumber}
          hole={currentHoleNumber}
          initialGreenie={
            currentGreenie
              ? { feet: currentGreenie.feet, inches: currentGreenie.inches }
              : null
          }
          onSaveAction={(value) => handleGreenieSave(currentHoleNumber, value)}
          onDeleteAction={() => handleGreenieDelete(currentHoleNumber)}
        />
      ) : null}

      {isComplete ? (
        <Button type="button" size="xl" onClick={onShowSummary}>
          Round summary
        </Button>
      ) : null}

      <div className="mt-auto flex flex-col gap-3 sm:mt-0">
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
            <Button
              type="button"
              variant="secondary"
              className="ml-auto flex-1"
              size="xl"
              disabled={!canScrollPrev}
              onClick={() => api?.scrollPrev()}
            >
              Back
            </Button>

            <Button
              type="button"
              className="flex-1"
              size="xl"
              disabled={!canScrollNext}
              onClick={() => api?.scrollNext()}
              variant="secondary"
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
