"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useImperativeHandle,
  useState,
  useTransition,
  type Ref,
} from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar01Icon, Delete02Icon } from "@hugeicons/core-free-icons";

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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SheetFooter } from "@/components/ui/sheet";
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
import { TournamentFormSchema, type TournamentFormValues } from "../schema";

type TournamentFormOutput = z.output<typeof TournamentFormSchema>;

export type TournamentSheetTournament = {
  id: number;
  clubHandle: string;
  clubName: string;
  date: Date;
  season: number;
  seasonId: number;
  courseHandle: string | null;
  courseName: string | null;
  courseImgUrl: string | null;
  teeId: number | null;
};

export type ClubOption = {
  handle: string;
  name: string;
  seasons: Array<{ id: number; number: number }>;
  currentSeasonId: number | null;
};
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

// The sheet keeps ownership of open/closed, but the dirty state that decides
// whether closing needs a discard confirm lives in here with the form — so it
// asks the form to close rather than closing itself.
export type TournamentFormHandle = {
  requestClose: () => void;
};

type TournamentFormProps = {
  mode: "create" | "edit";
  tournament?: TournamentSheetTournament;
  clubs: ClubOption[];
  courses: CourseOption[];
  /** `sheet` renders the sheet footer and closes on save; `page` stays put. */
  surface: "sheet" | "page";
  /** Sheet only: reset signal — the form re-seeds its values when this opens. */
  isOpen?: boolean;
  onCloseAction?: () => void;
  redirectOnCreate?: boolean;
  handleRef?: Ref<TournamentFormHandle>;
};

const emptyDefaults: TournamentFormValues = {
  clubHandle: "",
  date: "",
  seasonId: "",
  startNextSeason: false,
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

function toFormValues(
  t: TournamentSheetTournament | undefined,
  clubs: ClubOption[],
): TournamentFormValues {
  if (!t) {
    const club = clubs.length === 1 ? clubs[0] : undefined;
    return {
      ...emptyDefaults,
      clubHandle: club?.handle ?? "",
      seasonId: club?.currentSeasonId ?? "",
    };
  }
  return {
    clubHandle: t.clubHandle,
    date: toIsoDate(t.date),
    seasonId: t.seasonId,
    startNextSeason: false,
    courseHandle: t.courseHandle ?? "",
    teeId: t.teeId ?? "",
  };
}

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

export function TournamentForm({
  mode,
  tournament,
  clubs,
  courses,
  surface,
  isOpen,
  onCloseAction,
  redirectOnCreate = false,
  handleRef,
}: TournamentFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const form = useForm<TournamentFormValues, unknown, TournamentFormOutput>({
    resolver: zodResolver(TournamentFormSchema),
    defaultValues: toFormValues(tournament, clubs),
  });
  const serverError = form.formState.errors.root?.server?.message;
  const isDirty = form.formState.isDirty;
  const selectedCourseHandle = useWatch({
    control: form.control,
    name: "courseHandle",
  });
  const selectedClubHandle = useWatch({
    control: form.control,
    name: "clubHandle",
  });
  const startsNextSeason = useWatch({
    control: form.control,
    name: "startNextSeason",
  });
  const selectedClub = clubs.find((club) => club.handle === selectedClubHandle);

  useEffect(() => {
    if (isOpen) {
      form.reset(toFormValues(tournament, clubs));
    }
  }, [isOpen, tournament, clubs, form]);

  const close = () => {
    form.clearErrors("root.server");
    setDeleteError(null);
    setConfirmingDelete(false);
    setConfirmingDiscard(false);
    onCloseAction?.();
  };

  useImperativeHandle(handleRef, () => ({
    requestClose: () => {
      if (isDirty) {
        setConfirmingDiscard(true);
        setConfirmingDelete(false);
        return;
      }
      close();
    },
  }));

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
      router.push("/tournaments");
    });
  };

  const onSubmit = (values: TournamentFormOutput) => {
    if (
      values.startNextSeason &&
      !window.confirm("Start the next Season and create this Tournament?")
    )
      return;
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

      if (surface === "page") {
        // Stay on the tab; re-seed the form so it is no longer dirty and let the
        // server components around it pick the new details up.
        form.reset(form.getValues());
        router.refresh();
        return;
      }

      close();
      if (mode === "create" && redirectOnCreate && result.id != null) {
        router.push(`/tournaments/${result.id}`);
      }
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-1 flex-col"
      >
        <div
          className={cn(
            surface === "sheet" && "flex-1 overflow-y-auto px-4 pb-4",
          )}
        >
          <div className="flex flex-col gap-4">
            {serverError ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {serverError}
              </p>
            ) : null}

            <FormField
              control={form.control}
              name="clubHandle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Club</FormLabel>
                  <FormControl>
                    <select
                      className={selectClass}
                      {...field}
                      onChange={(event) => {
                        field.onChange(event);
                        const club = clubs.find(
                          (option) => option.handle === event.target.value,
                        );
                        form.setValue("seasonId", club?.currentSeasonId ?? "");
                        form.setValue("startNextSeason", false);
                      }}
                    >
                      <option value="">Select a club…</option>
                      {clubs.map((club) => (
                        <option key={club.handle} value={club.handle}>
                          {club.name}
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
              name="seasonId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Season</FormLabel>
                  <FormControl>
                    <select
                      className={selectClass}
                      value={startsNextSeason ? "next" : field.value}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      name={field.name}
                      onChange={(event) => {
                        const startNext = event.target.value === "next";
                        form.setValue("startNextSeason", startNext);
                        field.onChange(
                          startNext || event.target.value === ""
                            ? ""
                            : Number(event.target.value),
                        );
                      }}
                    >
                      <option value="">Select a Season…</option>
                      {selectedClub?.seasons.map((season) => (
                        <option key={season.id} value={season.id}>
                          Season {season.number}
                          {season.id === selectedClub.currentSeasonId
                            ? " (Current)"
                            : ""}
                        </option>
                      ))}
                      {mode === "create" && selectedClubHandle ? (
                        <option value="next">Start next Season…</option>
                      ) : null}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                            e.target.value === "" ? "" : Number(e.target.value),
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

        {surface === "sheet" ? (
          <SheetFooter>
            {confirmingDiscard ? (
              <SheetDiscardConfirm
                isPending={isPending}
                onKeepEditingAction={() => setConfirmingDiscard(false)}
                onDiscardAction={() => {
                  form.reset(toFormValues(tournament, clubs));
                  close();
                }}
              />
            ) : (
              <SheetFooterActions
                isPending={isPending}
                saveLabel={mode === "create" ? "Create" : "Save"}
                savingLabel="Saving…"
              />
            )}
          </SheetFooter>
        ) : (
          <div className="mt-6 flex flex-col gap-6">
            <div className="flex justify-end">
              <Button
                type="submit"
                size="xl"
                className="w-full sm:w-32"
                disabled={isPending || !isDirty}
              >
                {isPending ? "Saving…" : "Save"}
              </Button>
            </div>

            {mode === "edit" && tournament ? (
              <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 px-4 py-4">
                {confirmingDelete ? (
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
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Delete tournament</p>
                      <p className="text-sm text-muted-foreground">
                        Permanently removes this tournament.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={isPending}
                      onClick={() => {
                        setDeleteError(null);
                        setConfirmingDelete(true);
                      }}
                    >
                      <HugeiconsIcon
                        icon={Delete02Icon}
                        data-icon="inline-start"
                      />
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </form>
    </Form>
  );
}
