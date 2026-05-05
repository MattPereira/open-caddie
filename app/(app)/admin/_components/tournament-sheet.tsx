"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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
import {
  createTournament,
  deleteTournament,
  updateTournament,
} from "../actions";
import {
  TournamentFormSchema,
  type TournamentFormValues,
} from "../schema";

export type AdminTournament = {
  id: number;
  clubHandle: string;
  clubName: string;
  date: Date;
  courseHandle: string | null;
  courseName: string | null;
  courseImgUrl: string | null;
  tourYears: string;
};

export type ClubOption = { handle: string; name: string };
export type CourseOption = { handle: string; name: string };

type TournamentSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  tournament?: AdminTournament;
  clubs: ClubOption[];
  courses: CourseOption[];
  tourYears: string[];
};

const emptyDefaults: TournamentFormValues = {
  clubHandle: "",
  date: "",
  courseHandle: "",
  tourYears: "",
};

function toIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toFormValues(t?: AdminTournament): TournamentFormValues {
  if (!t) return emptyDefaults;
  return {
    clubHandle: t.clubHandle,
    date: toIsoDate(t.date),
    courseHandle: t.courseHandle ?? "",
    tourYears: t.tourYears,
  };
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
  tourYears,
}: TournamentSheetProps) {
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const form = useForm<TournamentFormValues>({
    resolver: zodResolver(TournamentFormSchema),
    defaultValues: toFormValues(tournament),
  });

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(tournament));
      setServerError(null);
      setDeleteError(null);
      setConfirmingDelete(false);
    }
  }, [open, tournament, form]);

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
      onOpenChange(false);
    });
  };

  const onSubmit = (values: TournamentFormValues) => {
    setServerError(null);
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createTournament(values)
          : await updateTournament({ ...values, id: tournament!.id });

      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      onOpenChange(false);
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
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
                        <Input type="date" {...field} />
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
                        <select className={selectClass} {...field}>
                          <option value="">None</option>
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
                  name="tourYears"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tour years</FormLabel>
                      <FormControl>
                        <select className={selectClass} {...field}>
                          <option value="">Select tour years…</option>
                          {tourYears.map((ty) => (
                            <option key={ty} value={ty}>
                              {ty}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <SheetFooter>
              {confirmingDelete && mode === "edit" && tournament ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-medium">
                    Are you sure? This permanently deletes this tournament.
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
                      {isDeleting ? "Deleting…" : "Yes, delete"}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <Button type="submit" disabled={isPending}>
                    {isPending
                      ? "Saving…"
                      : mode === "create"
                        ? "Create tournament"
                        : "Save changes"}
                  </Button>
                  <SheetClose asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isPending}
                    >
                      Cancel
                    </Button>
                  </SheetClose>
                  {mode === "edit" && tournament ? (
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={isPending}
                      onClick={() => {
                        setDeleteError(null);
                        setConfirmingDelete(true);
                      }}
                      className="sm:mr-auto"
                    >
                      Delete tournament
                    </Button>
                  ) : null}
                </>
              )}
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
