"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  FieldLegend,
  FieldLabel,
  FieldSet,
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
import { formatDate, toIsoDate, fromIsoDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { createRound } from "../../actions";
import { RoundConfigSchema, type RoundConfigValues } from "../../schema";

export type TeeOption = {
  id: number;
  name: string;
  totalYards: number | null;
};

export type CourseOption = {
  handle: string;
  name: string;
  rating: string;
  slope: number;
  imgUrl: string | null;
  tees: TeeOption[];
};

export type TournamentOption = {
  id: number;
  date: Date;
  season: number | null;
  clubName: string;
  courseHandle: string;
  courseName: string;
  courseImgUrl: string | null;
};

type RoundSetupFormProps = {
  courses: CourseOption[];
  tournaments: TournamentOption[];
  defaultDateIso: string;
};

type RoundMode = "tournament" | "casual";

export function RoundSetupForm({
  courses,
  tournaments,
  defaultDateIso,
}: RoundSetupFormProps) {
  const router = useRouter();
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
      teeId: null,
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
  const teeId = useWatch({ control: form.control, name: "teeId" });

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
      form.setValue("teeId", null, { shouldValidate: false });
      return;
    }

    setCourseOpen(false);
    setDateOpen(false);
    form.setValue("tournamentId", null, { shouldValidate: false });
    form.setValue("courseHandle", "", { shouldValidate: false });
    form.setValue("date", defaultDateIso, { shouldValidate: false });
    form.setValue("teeId", null, { shouldValidate: false });
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
      router.push(`/rounds/${result.roundId}/play`);
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex w-full flex-col gap-4"
      >
        <div className="flex flex-col gap-1 mb-2">
          <h1 className="text-2xl font-medium tracking-normal text-center">
            Set up round
          </h1>
        </div>

        <FieldSet>
          <FieldLegend variant="label" className="text-base!">
            Type
          </FieldLegend>
          <RadioGroup
            value={roundMode}
            onValueChange={handleRoundModeChange}
            className="grid grid-cols-2 gap-2"
          >
            <FieldLabel htmlFor="round-mode-tournament">
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle className="text-base">Tournament</FieldTitle>
                  <FieldDescription>For organized clubs</FieldDescription>
                </FieldContent>
                <RadioGroupItem
                  value="tournament"
                  id="round-mode-tournament"
                  className="size-5"
                />
              </Field>
            </FieldLabel>
            <FieldLabel htmlFor="round-mode-casual">
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle className="text-base">Casual</FieldTitle>
                  <FieldDescription>For informal play</FieldDescription>
                </FieldContent>
                <RadioGroupItem
                  value="casual"
                  id="round-mode-casual"
                  className="size-5"
                />
              </Field>
            </FieldLabel>
          </RadioGroup>
        </FieldSet>

        {roundMode === "tournament" ? (
          <FormField
            control={form.control}
            name="tournamentId"
            render={() => (
              <FormItem className="flex flex-col mb-31">
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
                          size="xl"
                          className={cn(
                            "w-full justify-between font-normal",
                            !selectedTournament && "text-muted-foreground",
                          )}
                        >
                          <span className="truncate">
                            {selectedTournament
                              ? `${formatDate(selectedTournament.date, "standard")} · ${selectedTournament.courseName}`
                              : "Choose a tournament"}
                          </span>
                          <HugeiconsIcon
                            icon={ArrowDown01Icon}
                            data-icon="inline-end"
                          />
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
              name="date"
              render={() => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-base">Date</FormLabel>
                  <Popover open={dateOpen} onOpenChange={setDateOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          size="xl"
                          className={cn(
                            "w-full justify-start font-normal",
                            !dateValue && "text-muted-foreground",
                          )}
                        >
                          <HugeiconsIcon
                            icon={Calendar01Icon}
                            data-icon="inline-start"
                          />
                          <span className="truncate">
                            {dateValue
                              ? formatDate(dateValue, "standard")
                              : "Choose a date"}
                          </span>
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

            <FormField
              control={form.control}
              name="courseHandle"
              render={() => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-base">Course</FormLabel>
                  <Popover open={courseOpen} onOpenChange={setCourseOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          size="xl"
                          className={cn(
                            "w-full justify-between font-normal",
                            !selectedCourse && "text-muted-foreground",
                          )}
                        >
                          <span className="truncate">
                            {selectedCourse?.name ?? "Choose a course"}
                          </span>
                          <HugeiconsIcon
                            icon={ArrowDown01Icon}
                            data-icon="inline-end"
                          />
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
                                  form.setValue("teeId", null, {
                                    shouldValidate: false,
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
              name="teeId"
              render={({ field }) => {
                const tees = selectedCourse?.tees ?? [];
                const disabled = !selectedCourse || tees.length === 0;
                return (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-base">Tees</FormLabel>
                    <FormControl>
                      <select
                        className={cn(
                          "flex h-12 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
                          field.value == null && "text-muted-foreground",
                        )}
                        disabled={disabled}
                        value={field.value == null ? "" : String(field.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        name={field.name}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                          )
                        }
                      >
                        <option value="">
                          {selectedCourse
                            ? tees.length === 0
                              ? "No tees configured for this course"
                              : "Choose tees"
                            : "Choose a course first"}
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
          </>
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={() => router.push("/")}
            size="xl"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              isPending ||
              (roundMode === "tournament" && !selectedTournament) ||
              (roundMode === "casual" && teeId == null) ||
              !courseHandle ||
              !dateValue
            }
            size="xl"
          >
            {isPending ? "Creating round…" : "Start round"}
          </Button>
        </div>
        {serverError ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverError}
          </p>
        ) : null}
      </form>
    </Form>
  );
}
