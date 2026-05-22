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

import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { HoldToConfirmButton } from "@/components/hold-to-confirm-button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { calculateCourseHandicap } from "@/lib/scoring";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { deleteRound, updateRoundScores } from "@/app/(app)/rounds/actions";
import {
  RoundScoresUpdateSchema,
  type RoundScoresUpdateValues,
} from "@/app/(app)/rounds/schema";
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
import { HoleScoreSlide, type HoleScoreSlideHandle } from "./hole-score-slide";
import { ScoreDictationButton } from "./score-dictation-button";
import {
  formatScore,
  type RoundScoresTableRound,
} from "@/components/round-scores-card";
import { MatchPlayContent } from "@/app/(app)/matches/[id]/_components/match-play-tab-content";
import { SkinsContent } from "@/app/(app)/matches/[id]/_components/skins-tab-content";
import { toRoundScoreRow } from "@/components/round-scores-card-row";
import { PlayScoresOverview } from "./play-scores-overview";
import {
  type ScoreEntry,
  buildInitialScores,
  isRoundComplete,
} from "./round-score-state";
import { HoleGreenieManager, type GreenieValue } from "./hole-greenie-manager";
import type { MatchPlayer, MatchScoreboard } from "./round-play";

type GreenieEntry = GreenieValue & { hole: number };

export type SettingsTee = {
  id: number;
  name: string;
  color: string | null;
  rating: string | number;
  slope: number;
  totalYards?: number | null;
};

type RoundScoresFormProps = {
  roundId: number;
  round: RoundScoresTableRound;
  leaderboardRounds?: RoundScoresTableRound[];
  date: Date | string;
  holes: {
    hole: number;
    par: number;
    handicap?: number | null;
    yards: number | null;
  }[];
  scores: ScoreEntry[];
  setScoresAction: Dispatch<SetStateAction<ScoreEntry[]>>;
  tees: SettingsTee[];
  matchPlayers: MatchPlayer[];
  matchScoreboard: MatchScoreboard | null;
  delegateRoundId: number | null;
  setDelegateRoundIdAction: (next: number | null) => void;
  onShowSummaryAction: () => void;
  summaryLabel: string;
};

export function RoundScoresForm({
  roundId,
  round,
  leaderboardRounds,
  date,
  holes,
  scores,
  setScoresAction,
  tees,
  matchPlayers,
  matchScoreboard,
  delegateRoundId,
  setDelegateRoundIdAction,
  onShowSummaryAction,
  summaryLabel,
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
  const saveVersionRef = useRef<Record<string, number>>({});
  const greenieSaveVersionRef = useRef<Record<string, number>>({});

  const delegatePlayer = useMemo(
    () =>
      matchPlayers.find((player) => player.roundId === delegateRoundId) ?? null,
    [matchPlayers, delegateRoundId],
  );
  const selfName = round.firstName ?? "You";
  const delegateName = delegatePlayer
    ? (delegatePlayer.firstName ?? delegatePlayer.lastName ?? "Player")
    : null;
  const initialDelegateScores = useMemo(
    () =>
      delegatePlayer ? buildInitialScores(delegatePlayer.scores, holes) : [],
    [delegatePlayer, holes],
  );
  const [delegateScores, setDelegateScores] = useState<ScoreEntry[]>(
    initialDelegateScores,
  );
  const [delegateGreenies, setDelegateGreenies] = useState<GreenieEntry[]>(
    () => delegatePlayer?.greenies ?? [],
  );
  const [prevDelegateRoundId, setPrevDelegateRoundId] =
    useState(delegateRoundId);
  if (prevDelegateRoundId !== delegateRoundId) {
    setPrevDelegateRoundId(delegateRoundId);
    setDelegateScores(initialDelegateScores);
    setDelegateGreenies(delegatePlayer?.greenies ?? []);
  }
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

  const saveScore = (
    targetRoundId: number,
    setTargetScores: Dispatch<SetStateAction<ScoreEntry[]>>,
    currentEntries: ScoreEntry[],
    hole: number,
    patch: { strokes: number | null; putts: number | null },
  ) => {
    const previousEntry = currentEntries.find((s) => s.hole === hole) ?? null;
    const versionKey = `${targetRoundId}:${hole}`;
    const saveVersion = (saveVersionRef.current[versionKey] ?? 0) + 1;
    saveVersionRef.current[versionKey] = saveVersion;

    setSaveError(null);
    setTargetScores((prev) =>
      prev.map((s) => (s.hole === hole ? { ...s, ...patch } : s)),
    );
    startSaveTransition(async () => {
      const result = await upsertRoundScore({
        roundId: targetRoundId,
        hole,
        ...patch,
      });
      if (!result.ok) {
        if (saveVersionRef.current[versionKey] !== saveVersion) return;
        if (previousEntry) {
          setTargetScores((prev) =>
            prev.map((s) => (s.hole === hole ? previousEntry : s)),
          );
        }
        setSaveError(result.error);
      }
    });
  };

  const saveGreenie = (
    targetRoundId: number,
    setTargetGreenies: Dispatch<SetStateAction<GreenieEntry[]>>,
    currentEntries: GreenieEntry[],
    hole: number,
    value: GreenieValue,
  ) => {
    const previousGreenie = currentEntries.find((g) => g.hole === hole) ?? null;
    const versionKey = `${targetRoundId}:${hole}`;
    const saveVersion = (greenieSaveVersionRef.current[versionKey] ?? 0) + 1;
    greenieSaveVersionRef.current[versionKey] = saveVersion;

    setSaveError(null);
    setTargetGreenies((prev) => {
      const nextGreenie = { hole, ...value };
      return prev.some((g) => g.hole === hole)
        ? prev.map((g) => (g.hole === hole ? nextGreenie : g))
        : [...prev, nextGreenie].sort((a, b) => a.hole - b.hole);
    });
    startSaveTransition(async () => {
      const result = await upsertRoundGreenie({
        roundId: targetRoundId,
        hole,
        ...value,
      });
      if (!result.ok) {
        if (greenieSaveVersionRef.current[versionKey] !== saveVersion) return;
        setTargetGreenies((prev) => {
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

  const removeGreenie = (
    targetRoundId: number,
    setTargetGreenies: Dispatch<SetStateAction<GreenieEntry[]>>,
    currentEntries: GreenieEntry[],
    hole: number,
  ) => {
    const previousGreenie = currentEntries.find((g) => g.hole === hole) ?? null;
    const versionKey = `${targetRoundId}:${hole}`;
    const saveVersion = (greenieSaveVersionRef.current[versionKey] ?? 0) + 1;
    greenieSaveVersionRef.current[versionKey] = saveVersion;

    setSaveError(null);
    setTargetGreenies((prev) => prev.filter((g) => g.hole !== hole));
    startSaveTransition(async () => {
      const result = await deleteRoundGreenie({
        roundId: targetRoundId,
        hole,
      });
      if (!result.ok) {
        if (greenieSaveVersionRef.current[versionKey] !== saveVersion) return;
        if (previousGreenie) {
          setTargetGreenies((prev) =>
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
  const currentGreenie =
    currentHoleNumber != null
      ? (greenies.find((g) => g.hole === currentHoleNumber) ?? null)
      : null;
  const currentDelegateGreenie =
    currentHoleNumber != null
      ? (delegateGreenies.find((g) => g.hole === currentHoleNumber) ?? null)
      : null;
  const liveMatchScoreboard = useMemo(() => {
    if (!matchScoreboard) return null;
    const rounds = matchScoreboard.rounds.map((scoreboardRound) => {
      if (scoreboardRound.id === round.id) {
        return round;
      }

      if (scoreboardRound.id === delegatePlayer?.roundId) {
        return applyScoreEntriesToRound(scoreboardRound, delegateScores);
      }

      return scoreboardRound;
    });
    const roundsById = new Map(
      rounds.map((scoreboardRound) => [scoreboardRound.id, scoreboardRound]),
    );

    return {
      ...matchScoreboard,
      rounds,
      teams: matchScoreboard.teams.map((team) => ({
        ...team,
        rounds: team.rounds.map(
          (teamRound) => roundsById.get(teamRound.id) ?? teamRound,
        ),
      })),
    };
  }, [delegatePlayer?.roundId, delegateScores, matchScoreboard, round]);

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-5 p-0 sm:flex-none">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-normal">
            {round.courseName ?? "Round"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {[toRoundScoreRow(round).playerName, formatDate(date, "short")]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <PlayScoresOverview
          players={
            delegatePlayer && delegateName
              ? [
                  { key: `round-${roundId}`, label: "You", scores },
                  {
                    key: `round-${delegatePlayer.roundId}`,
                    label: delegateName,
                    scores: delegateScores,
                  },
                ]
              : [{ key: `round-${roundId}`, label: "You", scores }]
          }
          currentHole={currentHoleNumber ?? 1}
        />
      </div>

      <div className="flex items-center gap-4">
        <Button
          type="button"
          size="xl"
          variant="secondary"
          disabled={!canScrollPrev}
          onClick={() => api?.scrollPrev()}
          aria-label="Previous hole"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
        </Button>
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-center gap-x-2 gap-y-1 text-center leading-tight">
          <span className="text-base font-medium tracking-tight">
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
          disabled={!canScrollNext}
          onClick={() => api?.scrollNext()}
          aria-label="Next hole"
        >
          <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
        </Button>
      </div>

      <Carousel setApi={setApi} className="w-full min-w-0">
        <CarouselContent>
          {scores.map((entry, index) => {
            const delegateEntry = delegateScores[index] ?? null;
            return (
              <CarouselItem key={entry.hole}>
                <HoleScoreCarouselItem
                  hole={entry.hole}
                  par={entry.par ?? 4}
                  selfName={selfName}
                  selfInitialStrokes={entry.strokes}
                  selfInitialPutts={entry.putts}
                  onSelfScoreChangeAction={(patch) =>
                    saveScore(roundId, setScoresAction, scores, entry.hole, patch)
                  }
                  delegate={
                    delegatePlayer && delegateName
                      ? {
                          roundId: delegatePlayer.roundId,
                          name: delegateName,
                          initialStrokes: delegateEntry?.strokes ?? null,
                          initialPutts: delegateEntry?.putts ?? null,
                          onScoreChangeAction: (patch) =>
                            saveScore(
                              delegatePlayer.roundId,
                              setDelegateScores,
                              delegateScores,
                              entry.hole,
                              patch,
                            ),
                        }
                      : null
                  }
                />
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>

      {saveError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {saveError}
        </p>
      ) : null}

      {currentHolePar === 3 && currentHoleNumber != null ? (
        <div className="flex flex-col gap-4">
          <HoleGreenieManager
            key={`self-${currentHoleNumber}`}
            hole={currentHoleNumber}
            idPrefix={`round-${roundId}`}
            playerName={selfName}
            initialGreenie={
              currentGreenie
                ? { feet: currentGreenie.feet, inches: currentGreenie.inches }
                : null
            }
            onSaveAction={(value) =>
              saveGreenie(
                roundId,
                setGreenies,
                greenies,
                currentHoleNumber,
                value,
              )
            }
            onDeleteAction={() =>
              removeGreenie(roundId, setGreenies, greenies, currentHoleNumber)
            }
          />
          {delegatePlayer && delegateName ? (
            <HoleGreenieManager
              key={`delegate-${delegatePlayer.roundId}-${currentHoleNumber}`}
              hole={currentHoleNumber}
              idPrefix={`round-${delegatePlayer.roundId}`}
              playerName={delegateName}
              initialGreenie={
                currentDelegateGreenie
                  ? {
                      feet: currentDelegateGreenie.feet,
                      inches: currentDelegateGreenie.inches,
                    }
                  : null
              }
              onSaveAction={(value) =>
                saveGreenie(
                  delegatePlayer.roundId,
                  setDelegateGreenies,
                  delegateGreenies,
                  currentHoleNumber,
                  value,
                )
              }
              onDeleteAction={() =>
                removeGreenie(
                  delegatePlayer.roundId,
                  setDelegateGreenies,
                  delegateGreenies,
                  currentHoleNumber,
                )
              }
            />
          ) : null}
        </div>
      ) : null}

      <div className="mt-auto flex items-center gap-2 sm:mt-0">
        <SettingsDialog
          roundId={roundId}
          round={round}
          tees={tees}
          matchPlayers={matchPlayers}
          delegateRoundId={delegateRoundId}
          setDelegateRoundIdAction={setDelegateRoundIdAction}
          fullWidth={round.tournamentId == null && round.matchId == null}
        />
        {round.tournamentId != null ? (
          <TournamentLeaderboardDialog
            currentRound={round}
            leaderboardRounds={leaderboardRounds}
          />
        ) : round.matchId != null ? (
          <MatchScoreboardDialog scoreboard={liveMatchScoreboard} />
        ) : null}
      </div>

      {isComplete ? (
        <Button type="button" size="2xl" onClick={onShowSummaryAction}>
          {summaryLabel}
        </Button>
      ) : null}
    </div>
  );
}

type DelegateSlideConfig = {
  roundId: number;
  name: string;
  initialStrokes: number | null;
  initialPutts: number | null;
  onScoreChangeAction: (patch: {
    strokes: number | null;
    putts: number | null;
  }) => void;
};

function HoleScoreCarouselItem({
  hole,
  par,
  selfName,
  selfInitialStrokes,
  selfInitialPutts,
  onSelfScoreChangeAction,
  delegate,
}: {
  hole: number;
  par: number;
  selfName: string;
  selfInitialStrokes: number | null;
  selfInitialPutts: number | null;
  onSelfScoreChangeAction: (patch: {
    strokes: number | null;
    putts: number | null;
  }) => void;
  delegate: DelegateSlideConfig | null;
}) {
  const selfRef = useRef<HoleScoreSlideHandle | null>(null);
  const delegateRef = useRef<HoleScoreSlideHandle | null>(null);

  return (
    <div className="flex flex-col gap-5">
      {delegate ? (
        <ScoreDictationButton
          mode="duo"
          par={par}
          selfName={selfName}
          delegateName={delegate.name}
          onDictatedDuoScoreAction={(patch) => {
            if (patch.you) selfRef.current?.applyDictatedScore(patch.you);
            if (patch.delegate)
              delegateRef.current?.applyDictatedScore(patch.delegate);
          }}
        />
      ) : (
        <ScoreDictationButton
          par={par}
          onDictatedScoreAction={(patch) =>
            selfRef.current?.applyDictatedScore(patch)
          }
        />
      )}

      <HoleScoreSlide
        ref={selfRef}
        hole={hole}
        par={par}
        idPrefix="self"
        playerName={selfName}
        initialStrokes={selfInitialStrokes}
        initialPutts={selfInitialPutts}
        onScoreChangeAction={onSelfScoreChangeAction}
      />

      {delegate ? (
        <HoleScoreSlide
          key={`delegate-${delegate.roundId}-${hole}`}
          ref={delegateRef}
          hole={hole}
          par={par}
          idPrefix={`delegate-${delegate.roundId}`}
          playerName={delegate.name}
          initialStrokes={delegate.initialStrokes}
          initialPutts={delegate.initialPutts}
          onScoreChangeAction={delegate.onScoreChangeAction}
        />
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
        <Button type="button" className="flex-1" size="xl">
          Scoreboard
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

function applyScoreEntriesToRound(
  round: RoundScoresTableRound,
  scores: ScoreEntry[],
): RoundScoresTableRound {
  const recordedScores = scores.filter((score) => score.strokes != null);
  const recordedPutts = scores.filter((score) => score.putts != null);

  return {
    ...round,
    recordedStrokesCount: recordedScores.length,
    recordedPuttsCount: recordedPutts.length,
    totalStrokes: recordedScores.reduce(
      (total, score) => total + (score.strokes ?? 0),
      0,
    ),
    totalPutts: recordedPutts.reduce(
      (total, score) => total + (score.putts ?? 0),
      0,
    ),
    scores: scores.map((score) => ({
      hole: score.hole,
      par: score.par,
      strokes: score.strokes,
      putts: score.putts,
    })),
  };
}

function buildSettingsFormValues(
  round: RoundScoresTableRound,
  tees: SettingsTee[],
): RoundScoresUpdateValues {
  const fallbackTeeId = tees[0]?.id ?? 0;
  return {
    roundId: round.id,
    teeId: round.teeId ?? fallbackTeeId,
    handicapIndexOverride:
      round.handicapIndexOverride == null
        ? ""
        : Number(round.handicapIndexOverride),
    scores: Array.from({ length: 18 }, (_, index) => {
      const hole = index + 1;
      const existing = round.scores.find((s) => s.hole === hole);
      return {
        hole,
        strokes: existing?.strokes ?? "",
        putts: existing?.putts ?? "",
      };
    }),
    greenies: (round.greenies ?? []).map((greenie) => ({
      hole: greenie.hole,
      feet: greenie.feet,
      inches: greenie.inches,
      action: "upsert" as const,
    })),
  };
}

function SettingsDialog({
  roundId,
  round,
  tees,
  matchPlayers,
  delegateRoundId,
  setDelegateRoundIdAction,
  fullWidth,
}: {
  roundId: number;
  round: RoundScoresTableRound;
  tees: SettingsTee[];
  matchPlayers: MatchPlayer[];
  delegateRoundId: number | null;
  setDelegateRoundIdAction: (next: number | null) => void;
  fullWidth: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const form = useForm<RoundScoresUpdateValues>({
    resolver: zodResolver(RoundScoresUpdateSchema),
    defaultValues: buildSettingsFormValues(round, tees),
  });
  const serverError = form.formState.errors.root?.server?.message;
  const showHandicapTab = round.matchId != null;
  const [activeTab, setActiveTab] = useState<"tees" | "handicap" | "scoring">(
    "tees",
  );
  const watchedTeeId = useWatch({ control: form.control, name: "teeId" });
  const watchedHandicapOverride = useWatch({
    control: form.control,
    name: "handicapIndexOverride",
  });
  const selectedTee = tees.find((tee) => tee.id === watchedTeeId);
  const selectedSlope = selectedTee?.slope ?? round.courseSlope ?? 113;
  const handicapIndex =
    typeof watchedHandicapOverride === "number" &&
    Number.isFinite(watchedHandicapOverride)
      ? watchedHandicapOverride
      : 0;
  const courseHandicap = calculateCourseHandicap(handicapIndex, selectedSlope);

  useEffect(() => {
    if (open) {
      form.reset(buildSettingsFormValues(round, tees));
    }
  }, [open, round, tees, form]);

  const handleOpenChange = (nextOpen: boolean) => {
    setConfirmingDelete(false);
    setDeleteError(null);
    if (nextOpen) setActiveTab("tees");
    setOpen(nextOpen);
  };

  const onSubmit = (values: RoundScoresUpdateValues) => {
    form.clearErrors("root.server");
    startTransition(async () => {
      const result = await updateRoundScores(values);
      if (!result.ok) {
        form.setError("root.server", {
          type: "server",
          message: result.error,
        });
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  const onDelete = () => {
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteRound(roundId);
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      setOpen(false);
      router.push("/");
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="xl"
          className={fullWidth ? "w-full" : "flex-1"}
        >
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[90dvh] max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden sm:h-auto sm:max-h-[85dvh] sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>Round settings</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pt-4">
              {serverError ? (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {serverError}
                </p>
              ) : null}

              <Tabs
                value={activeTab}
                onValueChange={(value) =>
                  setActiveTab(value as "tees" | "handicap" | "scoring")
                }
                className="gap-3"
              >
                <TabsList className="w-full">
                  <TabsTrigger value="tees" className="text-base">
                    Tees
                  </TabsTrigger>
                  {showHandicapTab ? (
                    <TabsTrigger value="handicap" className="text-base">
                      Handicap
                    </TabsTrigger>
                  ) : null}
                  {showHandicapTab ? (
                    <TabsTrigger value="scoring" className="text-base">
                      Scoring
                    </TabsTrigger>
                  ) : null}
                </TabsList>

                <TabsContent value="tees" className="flex flex-col gap-5">
                  <FormField
                    control={form.control}
                    name="teeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="sr-only">Tees</FormLabel>
                        <FieldSet>
                          <FormControl>
                            <RadioGroup
                              value={String(field.value)}
                              onValueChange={(value) =>
                                field.onChange(Number(value))
                              }
                              className="flex flex-col gap-2"
                            >
                              {tees.map((tee) => (
                                <FieldLabel
                                  key={tee.id}
                                  htmlFor={`settings-tee-${tee.id}`}
                                >
                                  <Field orientation="horizontal">
                                    <FieldContent>
                                      <FieldTitle className="flex items-center gap-2 text-base">
                                        {tee.color ? (
                                          <span
                                            className="size-3 rounded-full border"
                                            style={{
                                              backgroundColor: tee.color,
                                            }}
                                          />
                                        ) : null}
                                        {tee.name}
                                      </FieldTitle>
                                      <FieldDescription>
                                        {Number(tee.rating).toFixed(1)} /{" "}
                                        {tee.slope}
                                        {tee.totalYards != null
                                          ? ` - ${tee.totalYards.toLocaleString()} yds`
                                          : ""}
                                      </FieldDescription>
                                    </FieldContent>
                                    <RadioGroupItem
                                      id={`settings-tee-${tee.id}`}
                                      value={String(tee.id)}
                                      className="size-5"
                                    />
                                  </Field>
                                </FieldLabel>
                              ))}
                            </RadioGroup>
                          </FormControl>
                        </FieldSet>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                {showHandicapTab ? (
                  <TabsContent value="handicap" className="flex flex-col gap-3">
                    <Alert variant="info">
                      <AlertTitle>Course Handicap</AlertTitle>
                      <AlertDescription className="tabular-nums">
                        {handicapIndex.toFixed(1)} x {selectedSlope} / 113 ={" "}
                        {courseHandicap.toFixed(1)}
                      </AlertDescription>
                    </Alert>

                    <FormField
                      control={form.control}
                      name="handicapIndexOverride"
                      render={({ field }) => (
                        <FormItem className="grid grid-cols-[1fr_8rem] items-center gap-x-3 gap-y-1">
                          <FormLabel>Handicap Index</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={-10}
                              max={54}
                              step={0.1}
                              inputMode="decimal"
                              placeholder="Auto"
                              className="h-10 text-right"
                              {...field}
                              value={field.value === "" ? "" : field.value}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value === ""
                                    ? ""
                                    : Number(e.target.value),
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage className="col-span-2" />
                        </FormItem>
                      )}
                    />
                  </TabsContent>
                ) : null}

                {showHandicapTab ? (
                  <TabsContent value="scoring" className="flex flex-col gap-3">
                    <FieldSet>
                      <FieldLabel className="text-sm text-muted-foreground">
                        Record scores on behalf of another player in this match.
                      </FieldLabel>
                      <RadioGroup
                        value={
                          delegateRoundId == null
                            ? "none"
                            : String(delegateRoundId)
                        }
                        onValueChange={(value) =>
                          setDelegateRoundIdAction(
                            value === "none" ? null : Number(value),
                          )
                        }
                        className="flex flex-col gap-2"
                      >
                        <FieldLabel htmlFor="delegate-none">
                          <Field orientation="horizontal">
                            <FieldContent>
                              <FieldTitle className="text-base">
                                None
                              </FieldTitle>
                              <FieldDescription>
                                Only record your own scores.
                              </FieldDescription>
                            </FieldContent>
                            <RadioGroupItem
                              id="delegate-none"
                              value="none"
                              className="size-5"
                            />
                          </Field>
                        </FieldLabel>
                        {matchPlayers.map((player) => {
                          const name =
                            [player.firstName, player.lastName]
                              .filter(Boolean)
                              .join(" ") || "Player";
                          return (
                            <FieldLabel
                              key={player.roundId}
                              htmlFor={`delegate-${player.roundId}`}
                            >
                              <Field orientation="horizontal">
                                <FieldContent>
                                  <FieldTitle className="text-base">
                                    {name}
                                  </FieldTitle>
                                </FieldContent>
                                <RadioGroupItem
                                  id={`delegate-${player.roundId}`}
                                  value={String(player.roundId)}
                                  className="size-5"
                                />
                              </Field>
                            </FieldLabel>
                          );
                        })}
                      </RadioGroup>
                    </FieldSet>
                  </TabsContent>
                ) : null}
              </Tabs>
            </div>

            <div className="shrink-0 pt-4">
              {confirmingDelete ? (
                <div className="flex flex-col gap-3">
                  <div className="text-sm font-medium">
                    Delete this round?
                    <div className="text-sm font-normal text-muted-foreground">
                      This permanently deletes the round and all entered scores.
                    </div>
                  </div>
                  {deleteError ? (
                    <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {deleteError}
                    </p>
                  ) : null}
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="xl"
                      disabled={isDeleting}
                      onClick={() => {
                        setConfirmingDelete(false);
                        setDeleteError(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <HoldToConfirmButton
                      onConfirmAction={onDelete}
                      disabled={isDeleting}
                      idleLabel={
                        isDeleting ? "Deleting…" : "Hold to delete round"
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    disabled={isPending}
                    onClick={() => {
                      setDeleteError(null);
                      setConfirmingDelete(true);
                    }}
                    aria-label="Delete round"
                  >
                    <HugeiconsIcon icon={Delete02Icon} aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="xl"
                    disabled={isPending}
                    className="ml-auto"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="xl"
                    className="w-22"
                    disabled={isPending}
                  >
                    {isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function MatchScoreboardDialog({
  scoreboard,
}: {
  scoreboard: MatchScoreboard | null;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" className="flex-1" size="xl">
          Scoreboard
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[calc(100%-1.5rem)] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Scoreboard</DialogTitle>
          <DialogDescription>
            Match play and skins results for this match.
          </DialogDescription>
        </DialogHeader>
        {scoreboard ? (
          <Tabs defaultValue="match" className="w-full">
            <TabsList className="mb-3 h-10! w-full p-1 sm:w-fit">
              <TabsTrigger
                value="match"
                className="flex-1 px-5 py-2 text-base sm:flex-none"
              >
                Match
              </TabsTrigger>
              <TabsTrigger
                value="skins"
                className="flex-1 px-5 py-2 text-base sm:flex-none"
              >
                Skins
              </TabsTrigger>
            </TabsList>
            <TabsContent value="match" className="flex flex-col gap-5">
              <MatchPlayContent
                format={scoreboard.format}
                rounds={scoreboard.rounds}
                teams={scoreboard.teams}
              />
            </TabsContent>
            <TabsContent value="skins" className="flex flex-col gap-5">
              <SkinsContent rounds={scoreboard.rounds} />
            </TabsContent>
          </Tabs>
        ) : (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Scoreboard is not available for this round.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
