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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { HoldToConfirmButton } from "@/components/hold-to-confirm-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Field,
  FieldContent,
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
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { HoleScoreSlide } from "./hole-score-slide";
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

const MAX_DELEGATES = 3;

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
  delegateRoundIds: readonly number[];
  setDelegateRoundIdsAction: (next: readonly number[]) => void;
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
  delegateRoundIds,
  setDelegateRoundIdsAction,
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

  const [recordPutts, setRecordPutts] = useState(true);
  const [recordGreenies, setRecordGreenies] = useState(true);
  const selfName = round.firstName ?? "You";
  const delegatePlayers = useMemo(
    () =>
      delegateRoundIds
        .map((id) => matchPlayers.find((p) => p.roundId === id))
        .filter((p): p is MatchPlayer => p != null),
    [delegateRoundIds, matchPlayers],
  );
  const getPlayerName = (player: MatchPlayer) =>
    player.firstName || "Player";
  const [delegateScoresByRoundId, setDelegateScoresByRoundId] = useState<
    Record<number, ScoreEntry[]>
  >(() => {
    const map: Record<number, ScoreEntry[]> = {};
    for (const player of delegatePlayers) {
      map[player.roundId] = buildInitialScores(player.scores, holes);
    }
    return map;
  });
  const [delegateGreeniesByRoundId, setDelegateGreeniesByRoundId] = useState<
    Record<number, GreenieEntry[]>
  >(() => {
    const map: Record<number, GreenieEntry[]> = {};
    for (const player of delegatePlayers) {
      map[player.roundId] = player.greenies ?? [];
    }
    return map;
  });
  const delegateIdsKey = delegateRoundIds.join(",");
  const [prevDelegateIdsKey, setPrevDelegateIdsKey] = useState(delegateIdsKey);
  if (prevDelegateIdsKey !== delegateIdsKey) {
    setPrevDelegateIdsKey(delegateIdsKey);
    setDelegateScoresByRoundId((prev) => {
      const next: Record<number, ScoreEntry[]> = {};
      for (const player of delegatePlayers) {
        next[player.roundId] =
          prev[player.roundId] ?? buildInitialScores(player.scores, holes);
      }
      return next;
    });
    setDelegateGreeniesByRoundId((prev) => {
      const next: Record<number, GreenieEntry[]> = {};
      for (const player of delegatePlayers) {
        next[player.roundId] = prev[player.roundId] ?? player.greenies ?? [];
      }
      return next;
    });
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

  const updateScoresForRound = (
    targetRoundId: number,
    updater: (prev: ScoreEntry[]) => ScoreEntry[],
  ) => {
    if (targetRoundId === roundId) {
      setScoresAction(updater);
    } else {
      setDelegateScoresByRoundId((prev) => ({
        ...prev,
        [targetRoundId]: updater(prev[targetRoundId] ?? []),
      }));
    }
  };

  const updateGreeniesForRound = (
    targetRoundId: number,
    updater: (prev: GreenieEntry[]) => GreenieEntry[],
  ) => {
    if (targetRoundId === roundId) {
      setGreenies(updater);
    } else {
      setDelegateGreeniesByRoundId((prev) => ({
        ...prev,
        [targetRoundId]: updater(prev[targetRoundId] ?? []),
      }));
    }
  };

  const getScoresForRound = (targetRoundId: number): ScoreEntry[] => {
    if (targetRoundId === roundId) return scores;
    return delegateScoresByRoundId[targetRoundId] ?? [];
  };

  const getGreeniesForRound = (targetRoundId: number): GreenieEntry[] => {
    if (targetRoundId === roundId) return greenies;
    return delegateGreeniesByRoundId[targetRoundId] ?? [];
  };

  const saveScore = (
    targetRoundId: number,
    hole: number,
    patch: { strokes: number | null; putts: number | null },
  ) => {
    const previousEntry =
      getScoresForRound(targetRoundId).find((s) => s.hole === hole) ?? null;
    const versionKey = `${targetRoundId}:${hole}`;
    const saveVersion = (saveVersionRef.current[versionKey] ?? 0) + 1;
    saveVersionRef.current[versionKey] = saveVersion;

    setSaveError(null);
    updateScoresForRound(targetRoundId, (prev) =>
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
          updateScoresForRound(targetRoundId, (prev) =>
            prev.map((s) => (s.hole === hole ? previousEntry : s)),
          );
        }
        setSaveError(result.error);
      }
    });
  };

  const saveGreenie = (
    targetRoundId: number,
    hole: number,
    value: GreenieValue,
  ) => {
    const previousGreenie =
      getGreeniesForRound(targetRoundId).find((g) => g.hole === hole) ?? null;
    const versionKey = `${targetRoundId}:${hole}`;
    const saveVersion = (greenieSaveVersionRef.current[versionKey] ?? 0) + 1;
    greenieSaveVersionRef.current[versionKey] = saveVersion;

    setSaveError(null);
    updateGreeniesForRound(targetRoundId, (prev) => {
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
        updateGreeniesForRound(targetRoundId, (prev) => {
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

  const removeGreenie = (targetRoundId: number, hole: number) => {
    const previousGreenie =
      getGreeniesForRound(targetRoundId).find((g) => g.hole === hole) ?? null;
    const versionKey = `${targetRoundId}:${hole}`;
    const saveVersion = (greenieSaveVersionRef.current[versionKey] ?? 0) + 1;
    greenieSaveVersionRef.current[versionKey] = saveVersion;

    setSaveError(null);
    updateGreeniesForRound(targetRoundId, (prev) =>
      prev.filter((g) => g.hole !== hole),
    );
    startSaveTransition(async () => {
      const result = await deleteRoundGreenie({
        roundId: targetRoundId,
        hole,
      });
      if (!result.ok) {
        if (greenieSaveVersionRef.current[versionKey] !== saveVersion) return;
        if (previousGreenie) {
          updateGreeniesForRound(targetRoundId, (prev) =>
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
  const liveMatchScoreboard = useMemo(() => {
    if (!matchScoreboard) return null;
    const rounds = matchScoreboard.rounds.map((scoreboardRound) => {
      if (scoreboardRound.id === round.id) {
        return round;
      }
      const delegateScores = delegateScoresByRoundId[scoreboardRound.id];
      if (delegateScores) {
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
  }, [delegateScoresByRoundId, matchScoreboard, round]);

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
          players={[
            {
              key: `round-${roundId}`,
              label:
                [round.firstName, round.lastName].filter(Boolean).join(" ") ||
                "You",
              scores,
            },
            ...delegatePlayers.map((player) => ({
              key: `round-${player.roundId}`,
              label: getPlayerName(player),
              scores: delegateScoresByRoundId[player.roundId] ?? [],
            })),
          ]}
          currentHole={currentHoleNumber ?? 1}
          showPutts={recordPutts}
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
          {scores.map((entry) => {
            const par = entry.par ?? 4;
            return (
              <CarouselItem key={entry.hole}>
                <div className="flex flex-col gap-5">
                  <HoleScoreSlide
                    hole={entry.hole}
                    par={par}
                    idPrefix="self"
                    playerName={selfName}
                    initialStrokes={entry.strokes}
                    initialPutts={entry.putts}
                    showPutts={recordPutts}
                    onScoreChangeAction={(patch) =>
                      saveScore(roundId, entry.hole, patch)
                    }
                  />
                  {delegatePlayers.map((player) => {
                    const delegateEntry = (
                      delegateScoresByRoundId[player.roundId] ?? []
                    ).find((s) => s.hole === entry.hole);
                    return (
                      <HoleScoreSlide
                        key={`delegate-${player.roundId}-${entry.hole}`}
                        hole={entry.hole}
                        par={par}
                        idPrefix={`delegate-${player.roundId}`}
                        playerName={getPlayerName(player)}
                        initialStrokes={delegateEntry?.strokes ?? null}
                        initialPutts={delegateEntry?.putts ?? null}
                        showPutts={recordPutts}
                        onScoreChangeAction={(patch) =>
                          saveScore(player.roundId, entry.hole, patch)
                        }
                      />
                    );
                  })}
                </div>
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

      {recordGreenies && currentHolePar === 3 && currentHoleNumber != null ? (
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
              saveGreenie(roundId, currentHoleNumber, value)
            }
            onDeleteAction={() => removeGreenie(roundId, currentHoleNumber)}
          />
          {delegatePlayers.map((player) => {
            const delegateGreenie = (
              delegateGreeniesByRoundId[player.roundId] ?? []
            ).find((g) => g.hole === currentHoleNumber);
            return (
              <HoleGreenieManager
                key={`delegate-${player.roundId}-${currentHoleNumber}`}
                hole={currentHoleNumber}
                idPrefix={`round-${player.roundId}`}
                playerName={getPlayerName(player)}
                initialGreenie={
                  delegateGreenie
                    ? {
                        feet: delegateGreenie.feet,
                        inches: delegateGreenie.inches,
                      }
                    : null
                }
                onSaveAction={(value) =>
                  saveGreenie(player.roundId, currentHoleNumber, value)
                }
                onDeleteAction={() =>
                  removeGreenie(player.roundId, currentHoleNumber)
                }
              />
            );
          })}
        </div>
      ) : null}

      <div className="mt-auto flex items-center gap-2 sm:mt-0">
        <SettingsDialog
          roundId={roundId}
          round={round}
          tees={tees}
          matchPlayers={matchPlayers}
          delegateRoundIds={delegateRoundIds}
          setDelegateRoundIdsAction={setDelegateRoundIdsAction}
          recordPutts={recordPutts}
          setRecordPuttsAction={setRecordPutts}
          recordGreenies={recordGreenies}
          setRecordGreeniesAction={setRecordGreenies}
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
  delegateRoundIds,
  setDelegateRoundIdsAction,
  recordPutts,
  setRecordPuttsAction,
  recordGreenies,
  setRecordGreeniesAction,
  fullWidth,
}: {
  roundId: number;
  round: RoundScoresTableRound;
  tees: SettingsTee[];
  matchPlayers: MatchPlayer[];
  delegateRoundIds: readonly number[];
  setDelegateRoundIdsAction: (next: readonly number[]) => void;
  recordPutts: boolean;
  setRecordPuttsAction: Dispatch<SetStateAction<boolean>>;
  recordGreenies: boolean;
  setRecordGreeniesAction: Dispatch<SetStateAction<boolean>>;
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
  const showMatchOptions = round.matchId != null;
  useEffect(() => {
    if (open) {
      form.reset(buildSettingsFormValues(round, tees));
    }
  }, [open, round, tees, form]);

  const handleOpenChange = (nextOpen: boolean) => {
    setConfirmingDelete(false);
    setDeleteError(null);
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
          <DialogTitle className="text-xl">Settings</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pt-4">
              {serverError ? (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {serverError}
                </p>
              ) : null}

              <FormField
                control={form.control}
                name="teeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Choose Tees</FormLabel>
                    <FormControl>
                      <Select
                        value={String(field.value)}
                        onValueChange={(value) => field.onChange(Number(value))}
                      >
                        <SelectTrigger className="h-12 w-full px-3 text-base data-[size=default]:h-12">
                          <SelectValue placeholder="Select tees" />
                        </SelectTrigger>
                        <SelectContent>
                          {tees.map((tee) => (
                            <SelectItem key={tee.id} value={String(tee.id)}>
                              <span className="flex items-center gap-2">
                                {tee.color ? (
                                  <span
                                    className="size-3 rounded-full border"
                                    style={{ backgroundColor: tee.color }}
                                  />
                                ) : null}
                                <span>{tee.name}</span>
                                <span className="text-muted-foreground">
                                  {Number(tee.rating).toFixed(1)} / {tee.slope}
                                  {tee.totalYards != null
                                    ? ` · ${tee.totalYards.toLocaleString()} yds`
                                    : ""}
                                </span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FieldSet className="gap-2">
                <FieldLabel className="text-base">Record Putts</FieldLabel>
                <RadioGroup
                  value={recordPutts ? "yes" : "no"}
                  onValueChange={(v) => setRecordPuttsAction(v === "yes")}
                  className="flex flex-row gap-2"
                >
                  {(["yes", "no"] as const).map((v) => (
                    <FieldLabel
                      key={v}
                      htmlFor={`record-putts-${v}`}
                      className="flex-1"
                    >
                      <Field orientation="horizontal">
                        <RadioGroupItem
                          id={`record-putts-${v}`}
                          value={v}
                          className="size-5"
                        />
                        <FieldContent>
                          <FieldTitle className="text-base capitalize">
                            {v}
                          </FieldTitle>
                        </FieldContent>
                      </Field>
                    </FieldLabel>
                  ))}
                </RadioGroup>
              </FieldSet>

              <FieldSet className="gap-2">
                <FieldLabel className="text-base">Record Greenies</FieldLabel>
                <RadioGroup
                  value={recordGreenies ? "yes" : "no"}
                  onValueChange={(v) => setRecordGreeniesAction(v === "yes")}
                  className="flex flex-row gap-2"
                >
                  {(["yes", "no"] as const).map((v) => (
                    <FieldLabel
                      key={v}
                      htmlFor={`record-greenies-${v}`}
                      className="flex-1"
                    >
                      <Field orientation="horizontal">
                        <RadioGroupItem
                          id={`record-greenies-${v}`}
                          value={v}
                          className="size-5"
                        />
                        <FieldContent>
                          <FieldTitle className="text-base capitalize">
                            {v}
                          </FieldTitle>
                        </FieldContent>
                      </Field>
                    </FieldLabel>
                  ))}
                </RadioGroup>
              </FieldSet>

              {showMatchOptions && matchPlayers.length > 0 ? (
                <FieldSet className="gap-2">
                  <FieldLabel className="text-base">
                    Choose Players
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {delegateRoundIds.length}/{MAX_DELEGATES}
                    </span>
                  </FieldLabel>
                  <div className="flex flex-col gap-2">
                    {matchPlayers.map((player) => {
                      const name =
                        [player.firstName, player.lastName]
                          .filter(Boolean)
                          .join(" ") || "Player";
                      const checked = delegateRoundIds.includes(player.roundId);
                      const atCap =
                        !checked && delegateRoundIds.length >= MAX_DELEGATES;
                      const checkboxId = `delegate-${player.roundId}`;
                      return (
                        <FieldLabel
                          key={player.roundId}
                          htmlFor={checkboxId}
                          data-disabled={atCap || undefined}
                        >
                          <Field orientation="horizontal">
                            <Checkbox
                              id={checkboxId}
                              checked={checked}
                              disabled={atCap}
                              onCheckedChange={(next) =>
                                setDelegateRoundIdsAction(
                                  next
                                    ? [...delegateRoundIds, player.roundId]
                                    : delegateRoundIds.filter(
                                        (id) => id !== player.roundId,
                                      ),
                                )
                              }
                              className="size-5"
                            />
                            <FieldContent>
                              <FieldTitle className="text-base">
                                {name}
                              </FieldTitle>
                            </FieldContent>
                          </Field>
                        </FieldLabel>
                      );
                    })}
                  </div>
                </FieldSet>
              ) : null}
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
