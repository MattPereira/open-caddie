"use client";

import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useState,
  useTransition,
} from "react";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { HoldToConfirmButton } from "@/components/shared/hold-to-confirm-button";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteRound, updateRoundScores } from "@/app/(app)/rounds/actions";
import {
  RoundScoresUpdateSchema,
  type RoundScoresUpdateValues,
} from "@/app/(app)/rounds/schema";
import type { RoundScoresTableRound } from "@/components/features/scores/round-scores-card";
import type { ScoringPeer } from "./round-play";

export const MAX_DELEGATES = 3;

export type SettingsTee = {
  id: number;
  name: string;
  color: string | null;
  rating: string | number;
  slope: number;
  totalYards?: number | null;
};

function buildSettingsFormValues(
  round: RoundScoresTableRound,
  tees: SettingsTee[],
): RoundScoresUpdateValues {
  const fallbackTeeId = tees[0]?.id ?? 0;
  return {
    roundId: round.id,
    teeId: round.teeId ?? fallbackTeeId,
    playerIndexOverride:
      round.playerIndexOverride == null
        ? ""
        : Number(round.playerIndexOverride),
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

export function SettingsDialog({
  roundId,
  round,
  tees,
  scoringPeers,
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
  scoringPeers: ScoringPeer[];
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

              {scoringPeers.length > 0 ? (
                <FieldSet className="gap-2">
                  <FieldLabel className="text-base">
                    Choose Players
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {delegateRoundIds.length}/{MAX_DELEGATES}
                    </span>
                  </FieldLabel>
                  <div className="flex flex-col gap-2">
                    {scoringPeers.map((player) => {
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
