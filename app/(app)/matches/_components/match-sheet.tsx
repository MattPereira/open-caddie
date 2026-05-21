"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  PlayerCard,
  displayName,
  type PlayerCardPlayer,
} from "@/components/player-card";
import { SearchInput } from "@/components/search-input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormDescription,
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
import { cn, formatDate } from "@/lib/utils";
import { createMatch, deleteMatch, updateMatch } from "../actions";
import {
  MatchCreateSchema,
  MatchFormSchema,
  type MatchCreateValues,
  type MatchFormat,
  type MatchFormValues,
} from "../schema";

export type MatchSheetMatch = {
  id: number;
  date: Date;
  startsAt: string | null;
  name: string | null;
  courseHandle: string | null;
  courseName: string | null;
  courseImgUrl: string | null;
  format: MatchFormat;
  roundCount: number;
  rounds: MatchSheetRound[];
  teams: MatchSheetTeam[];
};

export type MatchPlayerOption = PlayerCardPlayer & { id: string };

export type MatchSheetRound = PlayerCardPlayer & {
  id: number;
};

export type MatchSheetTeam = {
  id: number;
  name: string;
  rounds: { id: number }[];
};

export type CourseOption = {
  handle: string;
  name: string;
  tees: {
    id: number;
    name: string;
    totalYards: number | null;
  }[];
};

type MatchSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  match?: MatchSheetMatch;
  courses: CourseOption[];
  players?: MatchPlayerOption[];
};

const emptyDefaults: MatchFormValues = {
  name: "",
  date: "",
  startsAt: "",
  courseHandle: "",
  format: "singles_match_play",
  teeId: 0,
  playerUserIds: [],
  teamOneUserIds: [],
  teamTwoUserIds: [],
  teamOneRoundIds: [],
  teamTwoRoundIds: [],
};

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

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

function DatePickerField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
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
          <HugeiconsIcon icon={Calendar01Icon} aria-hidden />
          {selected ? formatDate(selected, "standard") : "Pick a date"}
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

function toFormValues(match?: MatchSheetMatch): MatchFormValues {
  if (!match) return emptyDefaults;
  const defaultTeamOneRoundIds =
    match.teams[0]?.rounds.map((round) => round.id) ??
    (match.format === "four_ball_match_play" && match.rounds.length === 4
      ? match.rounds.slice(0, 2).map((round) => round.id)
      : []);
  const defaultTeamTwoRoundIds =
    match.teams[1]?.rounds.map((round) => round.id) ??
    (match.format === "four_ball_match_play" && match.rounds.length === 4
      ? match.rounds.slice(2, 4).map((round) => round.id)
      : []);

  return {
    name: match.name ?? "",
    date: toIsoDate(match.date),
    startsAt: match.startsAt?.slice(0, 5) ?? "",
    courseHandle: match.courseHandle ?? "",
    format: match.format,
    teeId: 0,
    playerUserIds: [],
    teamOneUserIds: [],
    teamTwoUserIds: [],
    teamOneRoundIds: defaultTeamOneRoundIds,
    teamTwoRoundIds: defaultTeamTwoRoundIds,
  };
}

export function MatchSheet({
  open,
  onOpenChange,
  mode,
  match,
  courses,
  players = [],
}: MatchSheetProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [playerQuery, setPlayerQuery] = useState("");

  const form = useForm<MatchFormValues>({
    resolver: zodResolver(mode === "create" ? MatchCreateSchema : MatchFormSchema),
    defaultValues: toFormValues(match),
  });
  const serverError = form.formState.errors.root?.server?.message;
  const [
    selectedCourseHandle,
    selectedFormat,
    selectedPlayerIds,
    teamOneUserIds,
    teamTwoUserIds,
    teamOneRoundIds,
    teamTwoRoundIds,
  ] = useWatch({
    control: form.control,
    name: [
      "courseHandle",
      "format",
      "playerUserIds",
      "teamOneUserIds",
      "teamTwoUserIds",
      "teamOneRoundIds",
      "teamTwoRoundIds",
    ],
  });
  const selectedCourse = courses.find(
    (course) => course.handle === selectedCourseHandle,
  );
  const selectedPlayers = players.filter((player) =>
    selectedPlayerIds.includes(player.id),
  );
  const filteredPlayers = useMemo(
    () => filterPlayers(players, playerQuery.trim().toLowerCase()),
    [players, playerQuery],
  );
  const requiredPlayerCount =
    selectedFormat === "singles_match_play" ? 2 : 4;
  const canAssignExistingTeams =
    mode === "edit" &&
    selectedFormat === "four_ball_match_play" &&
    match?.rounds.length === 4;

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(match));
    }
  }, [open, match, form]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      form.clearErrors("root.server");
      setDeleteError(null);
      setConfirmingDelete(false);
      setPlayerQuery("");
    }

    onOpenChange(nextOpen);
  };

  const onDelete = () => {
    if (!match) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteMatch(match.id);
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      setConfirmingDelete(false);
      router.replace("/matches");
    });
  };

  const onSubmit = (values: MatchFormValues) => {
    form.clearErrors("root.server");
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createMatch(values as MatchCreateValues)
          : await updateMatch({ ...values, id: match!.id });

      if (!result.ok) {
        form.setError("root.server", {
          type: "server",
          message: result.error,
        });
        return;
      }
      handleOpenChange(false);
    });
  };

  const setArrayValue = (
    name: "playerUserIds" | "teamOneUserIds" | "teamTwoUserIds",
    value: string[],
  ) => {
    form.setValue(name, value, {
      shouldDirty: true,
      shouldValidate: false,
    });
  };

  const setFormat = (format: MatchFormat) => {
    form.setValue("format", format, {
      shouldDirty: true,
      shouldValidate: false,
    });
    if (mode === "create") {
      setArrayValue("playerUserIds", []);
      setArrayValue("teamOneUserIds", []);
      setArrayValue("teamTwoUserIds", []);
      return;
    }

    if (
      format === "four_ball_match_play" &&
      match?.rounds.length === 4 &&
      teamOneRoundIds.length === 0 &&
      teamTwoRoundIds.length === 0
    ) {
      form.setValue(
        "teamOneRoundIds",
        match.rounds.slice(0, 2).map((round) => round.id),
        { shouldDirty: true, shouldValidate: false },
      );
      form.setValue(
        "teamTwoRoundIds",
        match.rounds.slice(2, 4).map((round) => round.id),
        { shouldDirty: true, shouldValidate: false },
      );
    }
  };

  const removePlayerFromTeams = (userId: string) => {
    setArrayValue(
      "teamOneUserIds",
      teamOneUserIds.filter((id) => id !== userId),
    );
    setArrayValue(
      "teamTwoUserIds",
      teamTwoUserIds.filter((id) => id !== userId),
    );
  };

  const setPlayerTeam = (userId: string, team: 1 | 2) => {
    if (!selectedPlayerIds.includes(userId)) return;

    const currentTeam = teamOneUserIds.includes(userId)
      ? 1
      : teamTwoUserIds.includes(userId)
        ? 2
        : null;
    if (currentTeam === team) return;

    let nextTeamOne = teamOneUserIds.filter((id) => id !== userId);
    let nextTeamTwo = teamTwoUserIds.filter((id) => id !== userId);

    if (team === 1) {
      if (nextTeamOne.length >= 2) {
        if (currentTeam !== 2) return;
        const [displaced, ...remaining] = nextTeamOne;
        nextTeamOne = remaining;
        nextTeamTwo.push(displaced);
      }
      nextTeamOne.push(userId);
    } else {
      if (nextTeamTwo.length >= 2) {
        if (currentTeam !== 1) return;
        const [displaced, ...remaining] = nextTeamTwo;
        nextTeamTwo = remaining;
        nextTeamOne.push(displaced);
      }
      nextTeamTwo.push(userId);
    }

    setArrayValue("teamOneUserIds", nextTeamOne);
    setArrayValue("teamTwoUserIds", nextTeamTwo);
  };

  const setRoundTeam = (roundId: number, team: 1 | 2) => {
    const currentTeam = teamOneRoundIds.includes(roundId)
      ? 1
      : teamTwoRoundIds.includes(roundId)
        ? 2
        : null;
    if (currentTeam === team) return;

    let nextTeamOne = teamOneRoundIds.filter((id) => id !== roundId);
    let nextTeamTwo = teamTwoRoundIds.filter((id) => id !== roundId);

    if (team === 1) {
      if (nextTeamOne.length >= 2) {
        if (currentTeam !== 2) return;
        const [displaced, ...remaining] = nextTeamOne;
        nextTeamOne = remaining;
        nextTeamTwo.push(displaced);
      }
      nextTeamOne.push(roundId);
    } else {
      if (nextTeamTwo.length >= 2) {
        if (currentTeam !== 1) return;
        const [displaced, ...remaining] = nextTeamTwo;
        nextTeamTwo = remaining;
        nextTeamOne.push(displaced);
      }
      nextTeamTwo.push(roundId);
    }

    form.setValue("teamOneRoundIds", nextTeamOne, {
      shouldDirty: true,
      shouldValidate: false,
    });
    form.setValue("teamTwoRoundIds", nextTeamTwo, {
      shouldDirty: true,
      shouldValidate: false,
    });
  };

  const togglePlayer = (userId: string) => {
    const selected = selectedPlayerIds.includes(userId);
    if (selected) {
      setArrayValue(
        "playerUserIds",
        selectedPlayerIds.filter((id) => id !== userId),
      );
      removePlayerFromTeams(userId);
      return;
    }

    if (selectedPlayerIds.length >= requiredPlayerCount) return;

    setArrayValue("playerUserIds", [...selectedPlayerIds, userId]);
    if (selectedFormat !== "four_ball_match_play") return;

    if (teamOneUserIds.length < 2) {
      setArrayValue("teamOneUserIds", [...teamOneUserIds, userId]);
    } else if (teamTwoUserIds.length < 2) {
      setArrayValue("teamTwoUserIds", [...teamTwoUserIds, userId]);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex h-dvh w-full flex-col gap-0 overflow-hidden sm:max-w-md">
        <SheetHeader className="shrink-0">
          <SheetTitle>{mode === "create" ? "Add match" : "Edit match"}</SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Schedule a casual match."
              : "Update this match's details."}
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

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Optional" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="format"
                  render={({ field }) => {
                    const formatLocked =
                      mode === "edit" &&
                      (match?.roundCount ?? 0) > 0 &&
                      ![2, 4].includes(match?.roundCount ?? 0);

                    return (
                      <FormItem>
                        <FormLabel>Format</FormLabel>
                        <FormControl>
                          <select
                            className={selectClass}
                            disabled={formatLocked}
                            value={field.value}
                            onBlur={field.onBlur}
                            ref={field.ref}
                            name={field.name}
                            onChange={(e) =>
                              setFormat(e.target.value as MatchFormat)
                            }
                          >
                            <option value="singles_match_play">
                              Singles match play
                            </option>
                            <option value="four_ball_match_play">
                              Four-ball match play
                            </option>
                          </select>
                        </FormControl>
                        {formatLocked ? (
                          <FormDescription>
                            Format can only be changed for 2-player or 4-player
                            matches.
                          </FormDescription>
                        ) : null}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
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
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="startsAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start time</FormLabel>
                      <FormControl>
                        <input
                          type="time"
                          className={selectClass}
                          {...field}
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
                            form.setValue("teeId", 0, {
                              shouldDirty: true,
                              shouldValidate: false,
                            });
                          }}
                        >
                          <option value="">Select a course...</option>
                          {courses.map((course) => (
                            <option key={course.handle} value={course.handle}>
                              {course.name}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {mode === "create" ? (
                  <>
                    <FormField
                      control={form.control}
                      name="teeId"
                      render={({ field }) => {
                        const tees = selectedCourse?.tees ?? [];
                        const disabled =
                          !selectedCourseHandle || tees.length === 0;

                        return (
                          <FormItem>
                            <FormLabel>Tees</FormLabel>
                            <FormControl>
                              <select
                                className={selectClass}
                                disabled={disabled}
                                value={field.value === 0 ? "" : String(field.value)}
                                onBlur={field.onBlur}
                                ref={field.ref}
                                name={field.name}
                                onChange={(e) =>
                                  field.onChange(
                                    e.target.value === ""
                                      ? 0
                                      : Number(e.target.value),
                                  )
                                }
                              >
                                <option value="">
                                  {selectedCourseHandle
                                    ? tees.length === 0
                                      ? "No tees configured for this course"
                                      : "Select a tee..."
                                    : "Select a course first"}
                                </option>
                                {tees.map((tee) => (
                                  <option key={tee.id} value={tee.id}>
                                    {tee.totalYards != null
                                      ? `${tee.name} - ${tee.totalYards.toLocaleString()} yds`
                                      : tee.name}
                                  </option>
                                ))}
                              </select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />

                    <FormField
                      control={form.control}
                      name="playerUserIds"
                      render={() => (
                        <FormItem>
                          <div className="flex items-center justify-between gap-3">
                            <FormLabel>Players</FormLabel>
                            <span className="text-sm text-muted-foreground">
                              {selectedPlayerIds.length}/{requiredPlayerCount}
                            </span>
                          </div>
                          <SearchInput
                            placeholder="Search players..."
                            value={playerQuery}
                            onValueChange={setPlayerQuery}
                          />
                          <div className="flex max-h-56 flex-col gap-2 overflow-y-auto px-1 py-1">
                            {filteredPlayers.length === 0 ? (
                              <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                                No players match your search.
                              </p>
                            ) : (
                              filteredPlayers.map((player) => {
                                const selected = selectedPlayerIds.includes(
                                  player.id,
                                );

                                return (
                                  <div
                                    key={player.id}
                                    className={cn(
                                      "relative rounded-xl",
                                      selected && "ring-2 ring-primary",
                                    )}
                                  >
                                    <PlayerCard
                                      player={player}
                                      size="sm"
                                      onClick={() => togglePlayer(player.id)}
                                    />
                                    {selected ? (
                                      <div className="pointer-events-none absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                        <HugeiconsIcon
                                          icon={Tick02Icon}
                                          aria-hidden
                                        />
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {selectedFormat === "four_ball_match_play" ? (
                      <FormField
                        control={form.control}
                        name="teamOneUserIds"
                        render={() => (
                          <FormItem>
                            <FormLabel>Teams</FormLabel>
                            <div className="flex flex-col gap-2">
                              {selectedPlayers.length === 0 ? (
                                <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                                  Select 4 players to assign teams.
                                </p>
                              ) : (
                                selectedPlayers.map((player) => (
                                  <div
                                    key={player.id}
                                    className="flex items-center justify-between gap-2 rounded-md border p-2"
                                  >
                                    <span className="min-w-0 truncate text-sm font-medium">
                                      {displayName(player)}
                                    </span>
                                    <div className="flex shrink-0 gap-1">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant={
                                          teamOneUserIds.includes(player.id)
                                            ? "default"
                                            : "outline"
                                        }
                                        onClick={() => setPlayerTeam(player.id, 1)}
                                      >
                                        Team A
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant={
                                          teamTwoUserIds.includes(player.id)
                                            ? "default"
                                            : "outline"
                                        }
                                        onClick={() => setPlayerTeam(player.id, 2)}
                                      >
                                        Team B
                                      </Button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : null}
                  </>
                ) : null}

                {canAssignExistingTeams ? (
                  <FormField
                    control={form.control}
                    name="teamOneRoundIds"
                    render={() => (
                      <FormItem>
                        <FormLabel>Teams</FormLabel>
                        <div className="flex flex-col gap-2">
                          {match.rounds.map((round) => (
                            <div
                              key={round.id}
                              className="flex items-center justify-between gap-2 rounded-md border p-2"
                            >
                              <span className="min-w-0 truncate text-sm font-medium">
                                {displayName(round)}
                              </span>
                              <div className="flex shrink-0 gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={
                                    teamOneRoundIds.includes(round.id)
                                      ? "default"
                                      : "outline"
                                  }
                                  onClick={() => setRoundTeam(round.id, 1)}
                                >
                                  Team A
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={
                                    teamTwoRoundIds.includes(round.id)
                                      ? "default"
                                      : "outline"
                                  }
                                  onClick={() => setRoundTeam(round.id, 2)}
                                >
                                  Team B
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : mode === "edit" &&
                  selectedFormat === "four_ball_match_play" ? (
                  <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    Four-ball match play requires exactly 4 player rounds.
                  </p>
                ) : null}
              </div>
            </div>

            <SheetFooter className="shrink-0 border-t bg-popover">
              {confirmingDelete && mode === "edit" && match ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-medium">
                    Are you sure? This permanently deletes this match and its
                    player rounds.
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
                <>
                  <Button type="submit" disabled={isPending}>
                    {isPending
                      ? "Saving..."
                      : mode === "create"
                        ? "Create match"
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
                  {mode === "edit" && match ? (
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
                      Delete match
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

function filterPlayers(players: MatchPlayerOption[], query: string) {
  if (!query) return players;

  return players.filter((player) => {
    const haystack = [
      displayName(player),
      player.email ?? "",
      player.username ?? "",
      player.firstName ?? "",
      player.lastName ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}
