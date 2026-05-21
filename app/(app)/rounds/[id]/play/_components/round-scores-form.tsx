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
  holes: { hole: number; par: number; yards: number | null }[];
  scores: ScoreEntry[];
  setScores: Dispatch<SetStateAction<ScoreEntry[]>>;
  tees: SettingsTee[];
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
  tees,
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
  const currentGreenie =
    currentHoleNumber != null
      ? (greenies.find((g) => g.hole === currentHoleNumber) ?? null)
      : null;

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
          scores={scores}
          currentHole={currentHoleNumber ?? 1}
          greenieHoles={new Set(greenies.map((g) => g.hole))}
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
        <SettingsDialog
          roundId={roundId}
          round={round}
          tees={tees}
          fullWidth={round.tournamentId == null && round.matchId == null}
        />
        {round.tournamentId != null ? (
          <TournamentLeaderboardDialog
            currentRound={round}
            leaderboardRounds={leaderboardRounds}
          />
        ) : round.matchId != null ? (
          <MatchScoreboardDialog />
        ) : null}
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
  fullWidth,
}: {
  roundId: number;
  round: RoundScoresTableRound;
  tees: SettingsTee[];
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
  const [activeTab, setActiveTab] = useState<"tees" | "handicap" | "scoring">("tees");
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
                  <p className="text-sm text-muted-foreground">
                    TODO: allow user to select another player in this match to
                    record scores on behalf of
                  </p>
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

function MatchScoreboardDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" className="flex-1" size="xl">
          Scoreboard
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100%-1.5rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Match scoreboard</DialogTitle>
          <DialogDescription>Match scoreboard will go here.</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
