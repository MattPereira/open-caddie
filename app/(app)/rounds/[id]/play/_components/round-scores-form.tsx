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
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ChartBarLineIcon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import {
  deleteRoundGreenie,
  upsertRoundGreenie,
  upsertRoundScore,
} from "../../../actions";
import { HoleScoreSlide } from "./hole-score-slide";
import {
  formatScore,
  type RoundScoresTableRound,
} from "@/components/round-scores-card";
import { toRoundScoreRow } from "@/components/round-scores-card-row";
import { PlayScoresOverview } from "./play-scores-overview";
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
  leaderboardRounds?: RoundScoresTableRound[];
  date: Date | string;
  holes: { hole: number; par: number; yards: number | null }[];
  scores: ScoreEntry[];
  setScores: Dispatch<SetStateAction<ScoreEntry[]>>;
  onShowSummary: () => void;
  onAbandoned: () => void;
};

export function RoundScoresForm({
  roundId,
  round,
  leaderboardRounds,
  date,
  holes,
  scores,
  setScores,
  onShowSummary,
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

  const currentHoleNumber = scores[current]?.hole;
  const currentHolePar = scores[current]?.par;
  const currentHoleYards = scores[current]?.yards;
  const currentScore = scores[current];
  const hasCurrentHoleScore =
    currentScore?.strokes != null && currentScore.putts != null;
  const currentGreenie =
    currentHoleNumber != null
      ? (greenies.find((g) => g.hole === currentHoleNumber) ?? null)
      : null;

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-5 p-0 sm:flex-none">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-xl font-semibold tracking-normal">
              {round.courseName ?? "Round"}
            </h1>
            <div className="ml-auto">
              <TournamentLeaderboardDialog
                currentRound={round}
                leaderboardRounds={leaderboardRounds}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {[toRoundScoreRow(round).playerName, formatDate(date, "short")]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <PlayScoresOverview
          scores={scores}
          currentHole={currentHoleNumber ?? 1}
          greenieHoles={new Set(greenies.map((g) => g.hole))}
        />
      </div>

      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="secondary"
          size="xl"
          className="shrink-0"
          disabled={!canScrollPrev}
          onClick={() => api?.scrollPrev()}
          aria-label="Previous hole"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
        </Button>
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-center gap-x-2 gap-y-1 text-center leading-tight">
          <span className="text-lg font-medium tracking-tight">
            Hole {currentHoleNumber}
          </span>
          <span className="text-sm uppercase tracking-wider text-muted-foreground">
            · Par {currentHolePar}
            {currentHoleYards != null
              ? ` · ${currentHoleYards.toLocaleString()} yds`
              : ""}
          </span>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="xl"
          className="shrink-0"
          disabled={!canScrollNext}
          onClick={() => api?.scrollNext()}
          aria-label="Next hole"
        >
          <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
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

      <div className="mt-auto flex items-center gap-2 sm:mt-0">
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
          variant={hasCurrentHoleScore ? "default" : "secondary"}
        >
          Next
        </Button>
      </div>

      {isComplete ? (
        <Button type="button" size="2xl" onClick={onShowSummary}>
          Round summary
        </Button>
      ) : null}
    </div>
  );
}

function TournamentLeaderboardDialog({
  currentRound,
  leaderboardRounds,
}: {
  currentRound: RoundScoresTableRound;
  leaderboardRounds?: RoundScoresTableRound[];
}) {
  if (currentRound.tournamentId == null || !leaderboardRounds?.length) {
    return null;
  }

  const leaderboardRows = leaderboardRounds
    .map((leaderboardRound) =>
      toLeaderboardRow(
        leaderboardRound.id === currentRound.id
          ? currentRound
          : leaderboardRound,
      ),
    )
    .sort(compareLeaderboardRows);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <HugeiconsIcon icon={ChartBarLineIcon} data-icon="inline-start" />
          Leaderboard
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100%-1.5rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tournament leaderboard</DialogTitle>
          <DialogDescription>
            Live totals from the scores entered so far.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-lg ring-1 ring-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Player</TableHead>
                <TableHead className="w-16 text-center">Thru</TableHead>
                <TableHead className="w-16 text-right">Str</TableHead>
                <TableHead className="w-16 text-right">Putts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboardRows.map((leaderboardRow) => (
                <TableRow
                  key={leaderboardRow.roundId}
                  data-state={
                    leaderboardRow.roundId === currentRound.id
                      ? "selected"
                      : undefined
                  }
                >
                  <TableCell className="max-w-36 truncate font-medium">
                    {leaderboardRow.playerName}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {formatScore(leaderboardRow.lastHole)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatScore(leaderboardRow.strokes)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatScore(leaderboardRow.putts)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type TournamentLeaderboardRow = {
  roundId: number;
  playerName: string;
  lastHole: number | null;
  strokes: number | null;
  putts: number | null;
};

function toLeaderboardRow(
  round: RoundScoresTableRound,
): TournamentLeaderboardRow {
  const row = toRoundScoreRow(round);

  return {
    roundId: round.id,
    playerName: row.playerName,
    lastHole: getLastScoredHole(round),
    strokes: row.metrics.strokes.total,
    putts: row.metrics.putts.total,
  };
}

function getLastScoredHole(round: RoundScoresTableRound) {
  return round.scores.reduce<number | null>((lastHole, score) => {
    if (score.strokes == null && score.putts == null) return lastHole;
    return Math.max(lastHole ?? 0, score.hole);
  }, null);
}

function compareLeaderboardRows(
  a: TournamentLeaderboardRow,
  b: TournamentLeaderboardRow,
) {
  const strokesCompare = compareNullableNumbers(a.strokes, b.strokes);
  if (strokesCompare !== 0) return strokesCompare;

  const lastHoleCompare = compareNullableNumbersDescending(
    a.lastHole,
    b.lastHole,
  );
  if (lastHoleCompare !== 0) return lastHoleCompare;

  return a.playerName.localeCompare(b.playerName);
}

function compareNullableNumbers(a: number | null, b: number | null) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

function compareNullableNumbersDescending(a: number | null, b: number | null) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return b - a;
}
