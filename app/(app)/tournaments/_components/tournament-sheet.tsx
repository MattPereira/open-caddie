"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  SheetDeleteConfirm,
  SheetDiscardConfirm,
  SheetFooterActions,
} from "@/components/shared/sheet-actions";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  createTournament,
  deleteTournament,
  updateTournament,
} from "../actions";
import {
  TournamentFormSchema,
  type TournamentFormValues,
} from "../schema";

type TournamentFormOutput = z.output<typeof TournamentFormSchema>;

export type TournamentSheetTournament = {
  id: number;
  clubHandle: string;
  clubName: string;
  date: Date;
  season: number | null;
  courseHandle: string | null;
  courseName: string | null;
  courseImgUrl: string | null;
  teeId: number | null;
};

export type ClubOption = { handle: string; name: string };
export type TeeOption = {
  id: number;
  name: string;
  totalYards: number | null;
};
export type CourseOption = {
  handle: string;
  name: string;
  tees: TeeOption[];
};

type TournamentSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  tournament?: TournamentSheetTournament;
  clubs: ClubOption[];
  courses: CourseOption[];
  redirectOnCreate?: boolean;
};

const emptyDefaults: TournamentFormValues = {
  clubHandle: "",
  date: "",
  season: "",
  courseHandle: "",
  teeId: "",
};

function toIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromIsoDate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return new Date(`${value}T00:00:00.000Z`);
}

type DatePickerFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

function DatePickerField({
  value,
  onChange,
  placeholder = "Pick a date",
}: DatePickerFieldProps) {
  const selected = fromIsoDate(value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start font-normal",
            !selected && "text-muted-foreground",
          )}
        >
          <HugeiconsIcon icon={Calendar01Icon} size={16} />
          {selected ? formatDate(selected, "standard") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            if (d) onChange(toIsoDate(d));
          }}
          captionLayout="dropdown"
        />
      </PopoverContent>
    </Popover>
  );
}

function toFormValues(t?: TournamentSheetTournament): TournamentFormValues {
  if (!t) return emptyDefaults;
  return {
    clubHandle: t.clubHandle,
    date: toIsoDate(t.date),
    season: t.season ?? "",
    courseHandle: t.courseHandle ?? "",
    teeId: t.teeId ?? "",
  };
}

function toNumberInputValue(value: number | "") {
  return value === "" ? "" : value;
}

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

export function TournamentSheet({
  open,
  onOpenChange,
  mode,
  tournament,
  clubs,
  courses,
  redirectOnCreate = false,
}: TournamentSheetProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const form = useForm<TournamentFormValues, unknown, TournamentFormOutput>({
    resolver: zodResolver(TournamentFormSchema),
    defaultValues: toFormValues(tournament),
  });
  const serverError = form.formState.errors.root?.server?.message;
  const isDirty = form.formState.isDirty;
  const selectedCourseHandle = useWatch({
    control: form.control,
    name: "courseHandle",
  });

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(tournament));
    }
  }, [open, tournament, form]);

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
    if (!tournament) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteTournament(tournament.id);
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      setConfirmingDelete(false);
      closeSheet();
    });
  };

  const onSubmit = (values: TournamentFormOutput) => {
    form.clearErrors("root.server");
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createTournament(values)
          : await updateTournament({ ...values, id: tournament!.id });

      if (!result.ok) {
        form.setError("root.server", {
          type: "server",
          message: result.error,
        });
        return;
      }
      closeSheet();
      if (mode === "create" && redirectOnCreate && result.id != null) {
        router.push(`/tournaments/${result.id}`);
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {mode === "create" ? "Add tournament" : "Edit tournament"}
          </SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Schedule a new tournament for a club."
              : "Update this tournament's details."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-1 flex-col"
          >
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <div className="flex flex-col gap-4">
                {serverError ? (
                  <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {serverError}
                  </p>
                ) : null}

                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <DatePickerField
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Pick a date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="season"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Season</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="clubHandle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Club</FormLabel>
                      <FormControl>
                        <select className={selectClass} {...field}>
                          <option value="">Select a club…</option>
                          {clubs.map((c) => (
                            <option key={c.handle} value={c.handle}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="courseHandle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Course</FormLabel>
                      <FormControl>
                        <select
                          className={selectClass}
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            form.setValue("teeId", "", {
                              shouldValidate: false,
                            });
                          }}
                        >
                          <option value="">Select a course...</option>
                          {courses.map((c) => (
                            <option key={c.handle} value={c.handle}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="teeId"
                  render={({ field }) => {
                    const selectedCourse = courses.find(
                      (c) => c.handle === selectedCourseHandle,
                    );
                    const tees = selectedCourse?.tees ?? [];
                    const disabled = !selectedCourseHandle || tees.length === 0;
                    return (
                      <FormItem>
                        <FormLabel>Tees</FormLabel>
                        <FormControl>
                          <select
                            className={selectClass}
                            disabled={disabled}
                            value={field.value === "" ? "" : String(field.value)}
                            onBlur={field.onBlur}
                            ref={field.ref}
                            name={field.name}
                            onChange={(e) => {
                              field.onChange(
                                e.target.value === ""
                                  ? ""
                                  : Number(e.target.value),
                              );
                            }}
                          >
                            <option value="">
                              {selectedCourseHandle
                                ? tees.length === 0
                                  ? "No tees configured for this course"
                                  : "Select a tee..."
                                : "Select a course first"}
                            </option>
                            {tees.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.totalYards != null
                                  ? `${t.name} — ${t.totalYards.toLocaleString()} yds`
                                  : t.name}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

              </div>
            </div>

            <SheetFooter>
              {confirmingDiscard ? (
                <SheetDiscardConfirm
                  isPending={isPending}
                  onKeepEditingAction={() => setConfirmingDiscard(false)}
                  onDiscardAction={() => {
                    form.reset(toFormValues(tournament));
                    closeSheet();
                  }}
                />
              ) : confirmingDelete && mode === "edit" && tournament ? (
                <SheetDeleteConfirm
                  title="Delete this tournament?"
                  description="This permanently deletes the tournament."
                  confirmLabel="Hold to delete tournament"
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
                  saveLabel={mode === "create" ? "Create" : "Save"}
                  savingLabel="Saving…"
                  onDeleteAction={
                    mode === "edit" && tournament
                      ? () => {
                          setDeleteError(null);
                          setConfirmingDelete(true);
                        }
                      : undefined
                  }
                  deleteAriaLabel="Delete tournament"
                />
              )}
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
