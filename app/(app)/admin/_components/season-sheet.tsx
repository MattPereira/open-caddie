"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { createSeason, deleteSeason, updateSeason } from "../actions";
import { SeasonFormSchema, type SeasonFormValues } from "../schema";
import type { ClubOption } from "./tournament-sheet";

export type AdminSeason = {
  id: number;
  clubHandle: string;
  clubName: string;
  number: number;
  startDate: Date;
  endDate: Date;
};

type SeasonSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  season?: AdminSeason;
  clubs: ClubOption[];
};

const emptyDefaults: SeasonFormValues = {
  clubHandle: "",
  number: 1,
  startDate: "",
  endDate: "",
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

function toFormValues(s?: AdminSeason): SeasonFormValues {
  if (!s) return emptyDefaults;
  return {
    clubHandle: s.clubHandle,
    number: s.number,
    startDate: toIsoDate(s.startDate),
    endDate: toIsoDate(s.endDate),
  };
}

const dateDisplay = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

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
          {selected ? dateDisplay.format(selected) : placeholder}
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

export function SeasonSheet({
  open,
  onOpenChange,
  mode,
  season,
  clubs,
}: SeasonSheetProps) {
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const form = useForm<SeasonFormValues>({
    resolver: zodResolver(SeasonFormSchema),
    defaultValues: toFormValues(season),
  });

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(season));
      setServerError(null);
      setDeleteError(null);
      setConfirmingDelete(false);
    }
  }, [open, season, form]);

  const onDelete = () => {
    if (!season) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteSeason(season.id);
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      setConfirmingDelete(false);
      onOpenChange(false);
    });
  };

  const onSubmit = (values: SeasonFormValues) => {
    setServerError(null);
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createSeason(values)
          : await updateSeason({ ...values, id: season!.id });

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
            {mode === "create" ? "Add season" : "Edit season"}
          </SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Create a new season for a club."
              : "Update this season's details."}
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
                  name="number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Season number</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          {...field}
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
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start date</FormLabel>
                      <FormControl>
                        <DatePickerField
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Pick a start date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End date</FormLabel>
                      <FormControl>
                        <DatePickerField
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Pick an end date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <SheetFooter>
              {confirmingDelete && mode === "edit" && season ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-medium">
                    Are you sure? This permanently deletes this season.
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
                        ? "Create season"
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
                  {mode === "edit" && season ? (
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
                      Delete season
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
