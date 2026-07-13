"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { deleteRound, updateRoundScores } from "@/app/(app)/rounds/actions";
import {
  RoundScoresUpdateSchema,
  type RoundScoresUpdateValues,
} from "@/app/(app)/rounds/schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  SheetDeleteConfirm,
  SheetDiscardConfirm,
  SheetFooterActions,
} from "@/components/sheet-actions";
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
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { calculateCourseHandicap } from "@/lib/handicap";

export type EditableRound = {
  id: number;
  matchId: number | null;
  teeId: number;
  userId: string;
  firstName: string | null;
  courseSlope: number;
  playerIndexOverride: string | number | null;
  tees: {
    id: number;
    name: string;
    color: string | null;
    rating: string | number;
    slope: number;
    totalYards?: number | null;
  }[];
  holes: {
    hole: number;
    par: number;
  }[];
  scores: {
    hole: number;
    par: number | null;
    strokes: number | null;
    putts: number | null;
  }[];
  greenies: {
    hole: number;
    feet: number;
    inches: number;
  }[];
};

const holeNumbers = Array.from({ length: 18 }, (_, index) => index + 1);
export type RoundScoresTab = "tees" | "scores" | "greenies";
type ScoreTab = "front" | "back";
const scoreTabs: {
  value: ScoreTab;
  label: string;
  holes: number[];
}[] = [
  { value: "front", label: "Front", holes: holeNumbers.slice(0, 9) },
  { value: "back", label: "Back", holes: holeNumbers.slice(9) },
];

function toFormValues(round: EditableRound): RoundScoresUpdateValues {
  const scoresByHole = new Map(
    round.scores.map((score) => [score.hole, score]),
  );
  const greeniesByHole = new Map(
    round.greenies.map((greenie) => [greenie.hole, greenie]),
  );

  return {
    roundId: round.id,
    teeId: round.teeId,
    playerIndexOverride:
      round.playerIndexOverride == null
        ? ""
        : Number(round.playerIndexOverride),
    scores: holeNumbers.map((hole) => {
      const score = scoresByHole.get(hole);
      return {
        hole,
        strokes: score?.strokes ?? "",
        putts: score?.putts ?? "",
      };
    }),
    greenies: round.holes
      .filter((hole) => hole.par === 3)
      .map((hole) => {
        const greenie = greeniesByHole.get(hole.hole);
        return {
          hole: hole.hole,
          feet: greenie?.feet ?? "",
          inches: greenie?.inches ?? "",
          action: greenie ? ("upsert" as const) : ("none" as const),
        };
      }),
  };
}

function toNumberInputValue(value: number | "") {
  return value === "" ? "" : value;
}

export function RoundScoresSheet({
  initialTab = "tees",
  onSaved,
  onDeleted,
  open,
  onOpenChange,
  round,
}: {
  initialTab?: RoundScoresTab;
  onSaved?: (values: RoundScoresUpdateValues) => void;
  onDeleted?: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  round: EditableRound;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [activeTab, setActiveTab] = useState<RoundScoresTab>(initialTab);
  const [scoreTab, setScoreTab] = useState<ScoreTab>("front");

  const form = useForm<RoundScoresUpdateValues>({
    resolver: zodResolver(RoundScoresUpdateSchema),
    defaultValues: toFormValues(round),
  });
  const serverError = form.formState.errors.root?.server?.message;
  const greenieRows =
    useWatch({ control: form.control, name: "greenies" }) ?? [];
  const teeId = useWatch({ control: form.control, name: "teeId" });
  const playerIndexOverride = useWatch({
    control: form.control,
    name: "playerIndexOverride",
  });
  const existingGreenieHoles = new Set(
    round.greenies.map((greenie) => greenie.hole),
  );
  const isDirty = form.formState.isDirty;
  const canEditPlayerIndexOverride = round.matchId != null;
  const selectedTee = round.tees.find((tee) => tee.id === teeId);
  const selectedSlope = selectedTee?.slope ?? round.courseSlope;
  const playerIndex =
    typeof playerIndexOverride === "number" &&
    Number.isFinite(playerIndexOverride)
      ? playerIndexOverride
      : 0;
  const courseHandicap = calculateCourseHandicap(playerIndex, selectedSlope);

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(round));
    }
  }, [open, round, form]);

  const closeSheet = () => {
    form.clearErrors("root.server");
    setDeleteError(null);
    setConfirmingDelete(false);
    setConfirmingDiscard(false);
    onOpenChange(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setConfirmingDiscard(false);
      onOpenChange(true);
      return;
    }

    if (isDirty) {
      setConfirmingDiscard(true);
      setConfirmingDelete(false);
      return;
    }

    closeSheet();
  };

  const onDelete = () => {
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteRound(round.id);
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      setConfirmingDelete(false);
      closeSheet();
      onDeleted?.();
    });
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
      onSaved?.(values);
      closeSheet();
      router.refresh();
    });
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex h-dvh w-full flex-col gap-0 overflow-hidden sm:max-w-xl">
        <SheetHeader className="shrink-0">
          <SheetTitle>
            {round.firstName ? `Edit ${round.firstName}'s round` : "Edit round"}
          </SheetTitle>
          <SheetDescription>
            Update strokes, putts, and greenies
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              <div className="flex flex-col gap-4">
                {serverError ? (
                  <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {serverError}
                  </p>
                ) : null}

                <Tabs
                  value={activeTab}
                  onValueChange={(value) =>
                    setActiveTab(value as RoundScoresTab)
                  }
                  className="gap-3"
                >
                  <TabsList className="w-full">
                    <TabsTrigger value="tees" className="text-base">
                      Tees
                    </TabsTrigger>
                    <TabsTrigger value="scores" className="text-base">
                      Scores
                    </TabsTrigger>
                    <TabsTrigger value="greenies" className="text-base">
                      Greenies
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="tees" className="flex flex-col gap-5">
                    <FormField
                      control={form.control}
                      name="teeId"
                      render={({ field }) => (
                        <FormItem>
                          <FieldSet>
                            <FormLabel className="sr-only">Tees</FormLabel>
                            <FormControl>
                              <RadioGroup
                                value={String(field.value)}
                                onValueChange={(value) =>
                                  field.onChange(Number(value))
                                }
                                className="flex flex-col gap-2"
                              >
                                {round.tees.map((tee) => (
                                  <FieldLabel
                                    key={tee.id}
                                    htmlFor={`round-tee-${tee.id}`}
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
                                        id={`round-tee-${tee.id}`}
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

                    {canEditPlayerIndexOverride ? (
                      <div className="flex flex-col gap-3">
                        <Alert variant="info">
                          <AlertTitle>Course Handicap</AlertTitle>
                          <AlertDescription className="tabular-nums">
                            {playerIndex.toFixed(1)} x {selectedSlope} / 113 ={" "}
                            {courseHandicap.toFixed(1)}
                          </AlertDescription>
                        </Alert>

                        <FormField
                          control={form.control}
                          name="playerIndexOverride"
                          render={({ field }) => (
                            <FormItem className="grid grid-cols-[1fr_8rem] items-center gap-x-3 gap-y-1">
                              <FormLabel>Player Index</FormLabel>
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
                                  value={toNumberInputValue(field.value)}
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
                      </div>
                    ) : null}
                  </TabsContent>

                  <TabsContent value="scores">
                    <Tabs
                      value={scoreTab}
                      onValueChange={(value) => setScoreTab(value as ScoreTab)}
                      className="gap-4"
                    >
                      <TabsList className="w-full">
                        {scoreTabs.map((tab) => (
                          <TabsTrigger
                            key={tab.value}
                            value={tab.value}
                            className="text-base"
                          >
                            {tab.label}
                          </TabsTrigger>
                        ))}
                      </TabsList>

                      {scoreTabs.map((tab) => (
                        <TabsContent
                          key={tab.value}
                          value={tab.value}
                          className="flex flex-col gap-4"
                        >
                          <div className="grid grid-cols-[4rem_1fr_1fr] gap-2 text-sm font-medium text-muted-foreground">
                            <span />
                            <span>Strokes</span>
                            <span>Putts</span>
                          </div>

                          {tab.holes.map((hole) => (
                            <ScoreInputRow
                              key={hole}
                              control={form.control}
                              hole={hole}
                              index={hole - 1}
                            />
                          ))}
                        </TabsContent>
                      ))}
                    </Tabs>
                  </TabsContent>

                  <TabsContent value="greenies" className="flex flex-col gap-6">
                    {greenieRows.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        This course does not have any par 3 holes.
                      </p>
                    ) : (
                      greenieRows.map((greenie, index) => (
                        <GreenieInputRow
                          key={greenie.hole}
                          form={form}
                          greenie={greenie}
                          index={index}
                          existing={existingGreenieHoles.has(greenie.hole)}
                        />
                      ))
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            <SheetFooter className="shrink-0">
              {confirmingDiscard ? (
                <SheetDiscardConfirm
                  isPending={isPending}
                  onKeepEditingAction={() => setConfirmingDiscard(false)}
                  onDiscardAction={() => {
                    form.reset(toFormValues(round));
                    closeSheet();
                  }}
                />
              ) : confirmingDelete ? (
                <SheetDeleteConfirm
                  title="Delete this round?"
                  description="This permanently deletes the round and all entered scores."
                  confirmLabel="Hold to delete round"
                  isDeleting={isDeleting}
                  error={deleteError}
                  onConfirmAction={onDelete}
                  onCancelAction={() => {
                    setConfirmingDelete(false);
                    setDeleteError(null);
                  }}
                />
              ) : (
                <SheetFooterActions
                  isPending={isPending}
                  onDeleteAction={() => {
                    setDeleteError(null);
                    setConfirmingDelete(true);
                  }}
                  deleteAriaLabel="Delete round"
                />
              )}
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

function ScoreInputRow({
  control,
  hole,
  index,
}: {
  control: ReturnType<typeof useForm<RoundScoresUpdateValues>>["control"];
  hole: number;
  index: number;
}) {
  return (
    <div className="grid grid-cols-[4rem_1fr_1fr] items-center gap-2">
      <div className="text-sm font-medium">Hole {hole}</div>

      <FormField
        control={control}
        name={`scores.${index}.strokes`}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="sr-only">Hole {hole} strokes</FormLabel>
            <FormControl>
              <Input
                type="number"
                min={1}
                step={1}
                className="h-10 text-center text-base"
                {...field}
                value={toNumberInputValue(field.value)}
                onChange={(e) =>
                  field.onChange(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name={`scores.${index}.putts`}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="sr-only">Hole {hole} putts</FormLabel>
            <FormControl>
              <Input
                type="number"
                min={0}
                step={1}
                className="h-10 text-center text-base"
                {...field}
                value={toNumberInputValue(field.value)}
                onChange={(e) =>
                  field.onChange(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

function GreenieInputRow({
  form,
  greenie,
  index,
  existing,
}: {
  form: ReturnType<typeof useForm<RoundScoresUpdateValues>>;
  greenie: RoundScoresUpdateValues["greenies"][number];
  index: number;
  existing: boolean;
}) {
  const isVisible =
    greenie.action === "upsert" || (existing && greenie.action === "none");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const setAction = (
    action: RoundScoresUpdateValues["greenies"][number]["action"],
  ) => {
    form.setValue(`greenies.${index}.action`, action, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const clearDistance = () => {
    form.setValue(`greenies.${index}.feet`, "", {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue(`greenies.${index}.inches`, "", {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  if (!isVisible) {
    return (
      <div className="grid grid-cols-[3.5rem_1fr] items-center gap-2 mt-5">
        <div className="text-sm font-medium">Hole {greenie.hole}</div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => {
            setConfirmingDelete(false);
            setAction("upsert");
          }}
        >
          <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" />
          Add greenie
        </Button>
      </div>
    );
  }

  if (confirmingDelete) {
    return (
      <div className="grid grid-cols-[3.5rem_1fr] items-center gap-2">
        <div className="text-sm font-medium">Hole {greenie.hole}</div>
        <div className="flex items-center justify-end gap-1">
          <span className="mr-auto whitespace-nowrap text-xs font-medium">
            Delete?
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setConfirmingDelete(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => {
              clearDistance();
              setAction(existing ? "delete" : "none");
              setConfirmingDelete(false);
            }}
          >
            Confirm
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[3.5rem_1fr_1fr_auto] items-start gap-2">
      <div className="pt-7 text-sm font-medium">Hole {greenie.hole}</div>

      <FormField
        control={form.control}
        name={`greenies.${index}.feet`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Feet</FormLabel>
            <FormControl>
              <Input
                type="number"
                min={0}
                step={1}
                className="text-center"
                aria-label={`Hole ${greenie.hole} feet`}
                {...field}
                value={toNumberInputValue(field.value)}
                onChange={(e) =>
                  field.onChange(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name={`greenies.${index}.inches`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Inches</FormLabel>
            <FormControl>
              <Input
                type="number"
                min={0}
                max={11}
                step={1}
                className="text-center"
                aria-label={`Hole ${greenie.hole} inches`}
                {...field}
                value={toNumberInputValue(field.value)}
                onChange={(e) =>
                  field.onChange(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="flex items-center gap-1 pt-6.5">
        <Button
          type="button"
          variant="destructive"
          size="icon-sm"
          onClick={() => setConfirmingDelete(true)}
          aria-label={`Delete greenie for hole ${greenie.hole}`}
        >
          <HugeiconsIcon icon={Delete02Icon} aria-hidden />
        </Button>
      </div>
    </div>
  );
}
