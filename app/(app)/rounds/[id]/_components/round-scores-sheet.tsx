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
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type EditableRound = {
  id: number;
  userId: string;
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
export type RoundScoresTab = "front" | "back" | "greenies";
const scoreTabs: {
  value: Exclude<RoundScoresTab, "greenies">;
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
  initialTab = "front",
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

  const form = useForm<RoundScoresUpdateValues>({
    resolver: zodResolver(RoundScoresUpdateSchema),
    defaultValues: toFormValues(round),
  });
  const serverError = form.formState.errors.root?.server?.message;
  const greenieRows =
    useWatch({ control: form.control, name: "greenies" }) ?? [];
  const existingGreenieHoles = new Set(
    round.greenies.map((greenie) => greenie.hole),
  );
  const isDirty = form.formState.isDirty;

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
          <SheetTitle>Edit round</SheetTitle>
          <SheetDescription>Update strokes and putts by hole.</SheetDescription>
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
                    {scoreTabs.map((tab) => (
                      <TabsTrigger key={tab.value} value={tab.value}>
                        {tab.label}
                      </TabsTrigger>
                    ))}
                    <TabsTrigger value="greenies">Greenies</TabsTrigger>
                  </TabsList>

                  {scoreTabs.map((tab) => (
                    <TabsContent
                      key={tab.value}
                      value={tab.value}
                      className="flex flex-col gap-2"
                    >
                      <div className="grid grid-cols-[4rem_1fr_1fr] gap-2 text-xs font-medium text-muted-foreground">
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

                  <TabsContent value="greenies" className="flex flex-col gap-2">
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
                <div className="flex flex-col gap-3">
                  <div className="text-sm font-medium">
                    You have unsaved changes!
                    <div className="text-sm text-muted-foreground">
                      Choose how to proceed:
                    </div>
                  </div>

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => {
                        form.reset(toFormValues(round));
                        closeSheet();
                      }}
                    >
                      Discard changes
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setConfirmingDiscard(false)}
                    >
                      Keep editing
                    </Button>
                    <Button type="submit" disabled={isPending}>
                      {isPending ? "Saving..." : "Save changes"}
                    </Button>
                  </div>
                </div>
              ) : confirmingDelete ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-medium">
                    Are you sure? This permanently deletes this round.
                  </p>
                  {deleteError ? (
                    <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {deleteError}
                    </p>
                  ) : null}
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isDeleting}
                      onClick={() => {
                        setConfirmingDelete(false);
                        setDeleteError(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={isDeleting}
                      onClick={onDelete}
                    >
                      {isDeleting ? "Deleting..." : "Yes, delete"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon-lg"
                    disabled={isPending}
                    onClick={() => {
                      setDeleteError(null);
                      setConfirmingDelete(true);
                    }}
                    aria-label="Delete round"
                  >
                    <HugeiconsIcon icon={Delete02Icon} aria-hidden />
                  </Button>
                  <SheetClose asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isPending}
                      className="ml-auto"
                    >
                      Cancel
                    </Button>
                  </SheetClose>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? "Saving..." : "Save changes"}
                  </Button>
                </div>
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
    <div className="grid grid-cols-[4rem_1fr_1fr] items-start gap-2">
      <div className="pt-2 text-sm font-medium">Hole {hole}</div>

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
                className="text-center"
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
                className="text-center"
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
      <div className="grid grid-cols-[3.5rem_1fr] items-center gap-2">
        <div className="text-sm font-medium">Hole {greenie.hole}</div>
        <Button
          type="button"
          size="sm"
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
            Delete this?
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
