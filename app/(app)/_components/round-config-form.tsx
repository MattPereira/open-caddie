"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, Calendar01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CourseCard } from "@/components/course-card";
import { TournamentCard } from "@/components/tournament-card";
import { cn, formatDate, toIsoDate, fromIsoDate } from "@/lib/utils";
import { createRound } from "../actions";
import { RoundConfigSchema, type RoundConfigValues } from "../schema";

export type CourseOption = {
  handle: string;
  name: string;
  rating: string;
  slope: number;
  imgUrl: string | null;
};

export type TournamentOption = {
  id: number;
  date: Date;
  startsAt: string | null;
  season: number | null;
  clubName: string;
  courseHandle: string;
  courseName: string;
  courseImgUrl: string | null;
};

type RoundConfigFormProps = {
  courses: CourseOption[];
  tournaments: TournamentOption[];
  defaultDateIso: string;
  onCreated: (result: { roundId: number; values: RoundConfigValues }) => void;
  onCancel: () => void;
};

type RoundMode = "tournament" | "casual";

export function RoundConfigForm({
  courses,
  tournaments,
  defaultDateIso,
  onCreated,
  onCancel,
}: RoundConfigFormProps) {
  const [isPending, startTransition] = useTransition();
  const [roundMode, setRoundMode] = useState<RoundMode>("tournament");
  const [courseOpen, setCourseOpen] = useState(false);
  const [tournamentOpen, setTournamentOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  const form = useForm<RoundConfigValues>({
    resolver: zodResolver(RoundConfigSchema),
    defaultValues: {
      courseHandle: "",
      date: defaultDateIso,
      tournamentId: null,
    },
  });

  const tournamentId = useWatch({
    control: form.control,
    name: "tournamentId",
  });
  const courseHandle = useWatch({
    control: form.control,
    name: "courseHandle",
  });
  const dateValue = useWatch({ control: form.control, name: "date" });

  const selectedTournament = useMemo(
    () => tournaments.find((t) => t.id === tournamentId) ?? null,
    [tournaments, tournamentId],
  );

  const selectedCourse = useMemo(
    () => courses.find((c) => c.handle === courseHandle) ?? null,
    [courses, courseHandle],
  );

  useEffect(() => {
    if (roundMode === "tournament" && selectedTournament) {
      form.setValue("courseHandle", selectedTournament.courseHandle, {
        shouldValidate: true,
      });
      form.setValue("date", toIsoDate(selectedTournament.date), {
        shouldValidate: true,
      });
    }
  }, [roundMode, selectedTournament, form]);

  const serverError = form.formState.errors.root?.server?.message;

  const handleRoundModeChange = (value: string) => {
    if (value !== "tournament" && value !== "casual") return;

    setRoundMode(value);
    form.clearErrors(["courseHandle", "date", "tournamentId"]);

    if (value === "casual") {
      setTournamentOpen(false);
      form.setValue("tournamentId", null, { shouldValidate: false });
      form.setValue("courseHandle", "", { shouldValidate: false });
      form.setValue("date", "", { shouldValidate: false });
      return;
    }

    setCourseOpen(false);
    setDateOpen(false);
    form.setValue("tournamentId", null, { shouldValidate: false });
    form.setValue("courseHandle", "", { shouldValidate: false });
    form.setValue("date", defaultDateIso, { shouldValidate: false });
  };

  const onSubmit = (values: RoundConfigValues) => {
    form.clearErrors("root.server");
    startTransition(async () => {
      const result = await createRound(values);
      if (!result.ok) {
        form.setError("root.server", {
          type: "server",
          message: result.error,
        });
        return;
      }
      onCreated({ roundId: result.roundId, values });
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex w-full flex-col gap-4"
      >
        {serverError ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverError}
          </p>
        ) : null}

        <RadioGroup
          value={roundMode}
          onValueChange={handleRoundModeChange}
          className="grid gap-2 grid-cols-2"
        >
          <FieldLabel htmlFor="round-mode-tournament">
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>Tournament</FieldTitle>
                <FieldDescription>For organized clubs</FieldDescription>
              </FieldContent>
              <RadioGroupItem value="tournament" id="round-mode-tournament" />
            </Field>
          </FieldLabel>
          <FieldLabel htmlFor="round-mode-casual">
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>Casual</FieldTitle>
                <FieldDescription>For informal play</FieldDescription>
              </FieldContent>
              <RadioGroupItem value="casual" id="round-mode-casual" />
            </Field>
          </FieldLabel>
        </RadioGroup>

        {roundMode === "tournament" ? (
          <FormField
            control={form.control}
            name="tournamentId"
            render={() => (
              <FormItem className="flex flex-col">
                <FormLabel>Tournament</FormLabel>
                <div className="flex gap-2">
                  <Popover
                    open={tournamentOpen}
                    onOpenChange={setTournamentOpen}
                  >
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "flex-1 justify-between font-normal",
                            !selectedTournament && "text-muted-foreground",
                          )}
                        >
                          {selectedTournament
                            ? `${formatDate(selectedTournament.date, "standard")} · ${selectedTournament.courseName}`
                            : "Pick a tournament"}
                          <HugeiconsIcon icon={ArrowDown01Icon} size={16} />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-(--radix-popover-trigger-width) p-0"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="Search tournaments..." />
                        <CommandList>
                          <CommandEmpty>No tournaments found.</CommandEmpty>
                          <CommandGroup>
                            {tournaments.map((t) => (
                              <CommandItem
                                key={t.id}
                                value={`${formatDate(t.date, "standard")} ${t.courseName} ${t.clubName}`}
                                data-checked={t.id === tournamentId}
                                onSelect={() => {
                                  form.setValue(
                                    "courseHandle",
                                    t.courseHandle,
                                    {
                                      shouldValidate: false,
                                    },
                                  );
                                  form.setValue("date", toIsoDate(t.date), {
                                    shouldValidate: false,
                                  });
                                  form.setValue("tournamentId", t.id, {
                                    shouldValidate: true,
                                  });
                                  setTournamentOpen(false);
                                }}
                                className="w-full p-0 [&>svg:last-child]:hidden"
                              >
                                <div className="w-full">
                                  <TournamentCard tournament={t} />
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        {roundMode === "casual" ? (
          <>
            <FormField
              control={form.control}
              name="courseHandle"
              render={() => (
                <FormItem className="flex flex-col">
                  <FormLabel>Course</FormLabel>
                  <Popover open={courseOpen} onOpenChange={setCourseOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "justify-between font-normal",
                            !selectedCourse && "text-muted-foreground",
                          )}
                        >
                          {selectedCourse?.name ?? "Pick a course"}
                          <HugeiconsIcon icon={ArrowDown01Icon} size={16} />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-(--radix-popover-trigger-width) p-0"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="Search courses..." />
                        <CommandList>
                          <CommandEmpty>No courses found.</CommandEmpty>
                          <CommandGroup>
                            {courses.map((c) => (
                              <CommandItem
                                key={c.handle}
                                value={c.name}
                                data-checked={c.handle === courseHandle}
                                onSelect={() => {
                                  form.setValue("courseHandle", c.handle, {
                                    shouldValidate: true,
                                  });
                                  setCourseOpen(false);
                                }}
                                className="w-full p-0 [&>svg:last-child]:hidden"
                              >
                                <div className="w-full">
                                  <CourseCard course={c} />
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={() => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
                  <Popover open={dateOpen} onOpenChange={setDateOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "justify-start font-normal",
                            !dateValue && "text-muted-foreground",
                          )}
                        >
                          <HugeiconsIcon icon={Calendar01Icon} size={16} />
                          {dateValue
                            ? formatDate(dateValue, "standard")
                            : "Pick a date"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={fromIsoDate(dateValue)}
                        onSelect={(d) => {
                          if (d) {
                            form.setValue("date", toIsoDate(d), {
                              shouldValidate: true,
                            });
                            setDateOpen(false);
                          }
                        }}
                        captionLayout="dropdown"
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={onCancel}
            size="lg"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              isPending ||
              (roundMode === "tournament" && !selectedTournament) ||
              !courseHandle ||
              !dateValue
            }
            size="lg"
          >
            {isPending ? "Creating round…" : "Create round"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
