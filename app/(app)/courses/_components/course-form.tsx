"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ImageUploadField } from "@/components/image-upload-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  startExistingCourseScorecardImport,
  deleteCourse,
  finalizeExistingCourseScorecardTeeMeta,
  type FinalizedScorecardDraft,
  replacePlaceholderTeeWithExistingTee,
  updateCourse,
} from "../actions";
import {
  CourseFormSchema,
  type CourseFormValues,
  type TeeFormValues,
} from "../schema";
import type { CourseForEdit, CourseForEditTee } from "@/db/queries/courses";

type CourseFormProps = {
  course: CourseForEdit;
};

type TeeMetaInputs = Array<{ rating: string; slope: string }>;

const defaultHoles: CourseFormValues["holes"] = Array.from(
  { length: 18 },
  (_, index) => ({
    hole: index + 1,
    par: "" as const,
    handicap: "" as const,
  }),
);

function teeToFormValues(tee: CourseForEditTee): TeeFormValues {
  return {
    id: tee.id,
    name: tee.name,
    color: tee.color ?? "",
    rating: tee.rating,
    slope: tee.slope,
    sortOrder: tee.sortOrder,
    yardages: Array.from({ length: 18 }, (_, index) => {
      const value = tee.yardages[index];
      return value == null ? ("" as const) : value;
    }),
  };
}

function toFormValues(course: CourseForEdit): CourseFormValues {
  const holesByNumber = new Map(course.holes.map((h) => [h.hole, h]));

  return {
    handle: course.handle,
    name: course.name,
    imgUrl: course.imgUrl ?? "",
    scorecardImgUrl: course.scorecardImgUrl ?? "",
    tees: course.tees.map(teeToFormValues),
    holes: defaultHoles.map((hole) => {
      const existing = holesByNumber.get(hole.hole);
      return {
        hole: hole.hole,
        par: existing?.par ?? "",
        handicap: existing?.handicap ?? "",
      };
    }),
  };
}

function toNumberInputValue(value: number | "") {
  return value === "" ? "" : value;
}

function sumPars(holes: CourseFormValues["holes"], start: number, end: number) {
  let total = 0;
  for (let i = start; i < end; i++) {
    const par = holes[i]?.par;
    if (typeof par === "number") total += par;
  }
  return total;
}

function sumYardages(
  yardages: TeeFormValues["yardages"] | undefined,
  start: number,
  end: number,
) {
  if (!yardages) return 0;
  let total = 0;
  for (let i = start; i < end; i++) {
    const y = yardages[i];
    if (typeof y === "number") total += y;
  }
  return total;
}

function isPlaceholderTeeName(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized === "unknown" || normalized === "unkown";
}

function hasCompleteYardages(tee: TeeFormValues) {
  return tee.yardages.every((yardage) => typeof yardage === "number");
}

type ScorecardTableProps = {
  control: import("react-hook-form").Control<CourseFormValues>;
  selectedTeeIndex?: number;
};

type TeeEditCardProps = {
  control: import("react-hook-form").Control<CourseFormValues>;
  index: number;
};

function TeeEditCard({ control, index }: TeeEditCardProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_4.75rem_4.25rem] items-end gap-3 rounded-md border p-3">
      <FormField
        control={control}
        name={`tees.${index}.name`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tee name</FormLabel>
            <FormControl>
              <Input {...field} placeholder="Blue" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={`tees.${index}.rating`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Rating</FormLabel>
            <FormControl>
              <Input
                {...field}
                type="number"
                inputMode="decimal"
                min="0.1"
                step="0.1"
                className="tabular-nums"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={`tees.${index}.slope`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Slope</FormLabel>
            <FormControl>
              <Input
                type="number"
                min={55}
                max={155}
                step={1}
                className="tabular-nums"
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

function ScorecardTable({ control, selectedTeeIndex }: ScorecardTableProps) {
  const holes = useWatch({
    control,
    name: "holes",
  }) as CourseFormValues["holes"];
  const tees = useWatch({ control, name: "tees" }) as TeeFormValues[];
  const visibleTeeIndexes =
    selectedTeeIndex == null
      ? tees.map((_, index) => index)
      : [selectedTeeIndex];
  const outPar = sumPars(holes, 0, 9);
  const inPar = sumPars(holes, 9, 18);
  const totalPar = outPar + inPar;
  const teeTotals = tees.map((tee) => ({
    out: sumYardages(tee?.yardages, 0, 9),
    in: sumYardages(tee?.yardages, 9, 18),
  }));

  const renderHoleRow = (index: number) => {
    const hole = index + 1;
    return (
      <TableRow key={hole}>
        <TableCell className="h-11 px-2 font-medium tabular-nums">
          {hole}
        </TableCell>
        <TableCell className="px-1 py-1 text-center">
          <FormField
            control={control}
            name={`holes.${index}.par`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="sr-only">Hole {hole} par</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={2}
                    max={7}
                    step={1}
                    className="mx-auto h-8 w-14 text-center tabular-nums"
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
        </TableCell>
        <TableCell className="px-1 py-1 text-center">
          <FormField
            control={control}
            name={`holes.${index}.handicap`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="sr-only">Hole {hole} handicap</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={18}
                    step={1}
                    className="mx-auto h-8 w-14 text-center tabular-nums"
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
        </TableCell>
        {visibleTeeIndexes.map((teeIndex) => (
          <TableCell key={teeIndex} className="px-1 py-1 text-center">
            <FormField
              control={control}
              name={`tees.${teeIndex}.yardages.${index}`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Hole {hole} yardage</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      className="mx-auto h-8 w-20 text-center tabular-nums"
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
          </TableCell>
        ))}
      </TableRow>
    );
  };

  const totalRow = (
    label: string,
    parTotal: number,
    getTeeTotal: (teeIndex: number) => number,
  ) => (
    <TableRow className="bg-muted/40">
      <TableCell className="h-10 px-2 font-medium">{label}</TableCell>
      <TableCell className="px-1 text-center font-medium tabular-nums">
        {parTotal || ""}
      </TableCell>
      <TableCell />
      {visibleTeeIndexes.map((teeIndex) => {
        const tee = tees[teeIndex];
        return (
          <TableCell
            key={`${tee?.name ?? "tee"}-${teeIndex}-${label}`}
            className="px-1 text-center font-medium tabular-nums"
          >
            {getTeeTotal(teeIndex) || ""}
          </TableCell>
        );
      })}
    </TableRow>
  );

  return (
    <Table className="min-w-max table-fixed">
      <colgroup>
        <col className="w-14" />
        <col className="w-16" />
        <col className="w-16" />
        {visibleTeeIndexes.map((teeIndex) => {
          const tee = tees[teeIndex];
          return (
            <col key={`${tee?.name ?? "tee"}-${teeIndex}`} className="w-28" />
          );
        })}
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead className="px-2">Hole</TableHead>
          <TableHead className="px-1 text-center">Par</TableHead>
          <TableHead className="px-1 text-center">Hdcp</TableHead>
          {visibleTeeIndexes.map((teeIndex) => {
            const tee = tees[teeIndex];
            return (
              <TableHead key={teeIndex} className="px-1 text-center">
                <span className="block truncate">
                  {tee?.name?.trim() || `Tee ${teeIndex + 1}`}
                </span>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 9 }, (_, i) => renderHoleRow(i))}
        {totalRow("Out", outPar, (teeIndex) => teeTotals[teeIndex].out)}
        {Array.from({ length: 9 }, (_, i) => renderHoleRow(i + 9))}
        {totalRow("In", inPar, (teeIndex) => teeTotals[teeIndex].in)}
        {totalRow(
          "Total",
          totalPar,
          (teeIndex) => teeTotals[teeIndex].out + teeTotals[teeIndex].in,
        )}
      </TableBody>
    </Table>
  );
}

export function CourseForm({ course }: CourseFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isReplacingTee, startReplaceTeeTransition] = useTransition();
  const [isFinalizingTeeMeta, startFinalizeTeeMetaTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedTeeIndex, setSelectedTeeIndex] = useState(0);
  const [replacementSourceTeeId, setReplacementSourceTeeId] = useState("");
  const [pendingTeeMetaDraft, setPendingTeeMetaDraft] =
    useState<FinalizedScorecardDraft | null>(null);
  const [teeMetaInputs, setTeeMetaInputs] = useState<TeeMetaInputs>([]);
  const [teeMetaError, setTeeMetaError] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(CourseFormSchema),
    defaultValues: toFormValues(course),
  });
  const serverError = form.formState.errors.root?.server?.message;
  const teesError = form.formState.errors.tees?.root?.message;
  const watchedTees = useWatch({
    control: form.control,
    name: "tees",
  }) as TeeFormValues[];

  const { fields: teeFields } = useFieldArray({
    control: form.control,
    name: "tees",
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const updateIsDesktop = () => setIsDesktop(mediaQuery.matches);
    updateIsDesktop();
    mediaQuery.addEventListener("change", updateIsDesktop);
    return () => mediaQuery.removeEventListener("change", updateIsDesktop);
  }, []);

  const effectiveSelectedTeeIndex = teeFields[selectedTeeIndex]
    ? selectedTeeIndex
    : 0;
  const selectedTee = teeFields[effectiveSelectedTeeIndex];
  const placeholderTee = watchedTees.find(
    (tee) =>
      tee.id &&
      isPlaceholderTeeName(tee.name) &&
      !tee.yardages.some((yardage) => typeof yardage === "number"),
  );
  const replacementSourceTees = watchedTees.filter(
    (tee) =>
      tee.id && tee.id !== placeholderTee?.id && hasCompleteYardages(tee),
  );
  const suggestedReplacementMatches =
    placeholderTee == null
      ? []
      : replacementSourceTees.filter(
          (tee) =>
            Number(tee.rating) === Number(placeholderTee.rating) &&
            tee.slope === placeholderTee.slope,
        );
  const suggestedReplacementTee =
    suggestedReplacementMatches.length === 1
      ? suggestedReplacementMatches[0]
      : undefined;
  const selectedReplacementSourceTeeId =
    replacementSourceTeeId ||
    (suggestedReplacementTee?.id ? String(suggestedReplacementTee.id) : "");

  const resetSyncedTees = (
    tees: CourseForEditTee[],
    scorecardImgUrl?: string,
  ) => {
    const currentValues = form.getValues();
    form.reset(
      {
        ...currentValues,
        scorecardImgUrl: scorecardImgUrl ?? currentValues.scorecardImgUrl,
        tees: tees.map(teeToFormValues),
      },
      { keepDirty: true },
    );
    setSelectedTeeIndex(0);
  };

  const onSubmit = (values: CourseFormValues) => {
    form.clearErrors("root.server");
    startTransition(async () => {
      const result = await updateCourse({ ...values, id: course.id });
      if (!result.ok) {
        form.setError("root.server", {
          type: "server",
          message: result.error,
        });
        return;
      }
      router.push(`/courses/${result.handle}`);
      router.refresh();
    });
  };

  const onDelete = () => {
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteCourse(course.id);
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      router.push("/courses");
      router.refresh();
    });
  };

  const onScorecardImageChange = async (url: string | null) => {
    form.setValue("scorecardImgUrl", url ?? "", {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.clearErrors("root.server");

    if (!url) return;

    const result = await startExistingCourseScorecardImport({
      courseId: course.id,
      stagedScorecardImageHandle: url,
    });
    if (result.outcome === "rejected") {
      form.setError("root.server", {
        type: "server",
        message: result.error,
      });
      return;
    }
    if (result.outcome === "paused") router.push(`/courses/imports/${result.import.id}`);
    if (result.outcome === "published") router.push(`/courses/${result.handle}`);
  };

  const onSubmitTeeMeta = () => {
    if (!pendingTeeMetaDraft) return;
    setTeeMetaError(null);

    const finalizedTees = pendingTeeMetaDraft.tees.map((tee, i) => {
      const rating = Number(teeMetaInputs[i]?.rating);
      const slope = Number(teeMetaInputs[i]?.slope);
      return { tee, rating, slope };
    });

    for (const { tee, rating, slope } of finalizedTees) {
      if (!Number.isFinite(rating) || rating <= 0) {
        setTeeMetaError(`Enter a valid rating for ${tee.name}.`);
        return;
      }
      if (!Number.isInteger(slope) || slope < 55 || slope > 155) {
        setTeeMetaError(`Slope for ${tee.name} must be between 55 and 155.`);
        return;
      }
    }

    startFinalizeTeeMetaTransition(async () => {
      const result = await finalizeExistingCourseScorecardTeeMeta({
        courseId: course.id,
        tees: finalizedTees.map(({ tee, rating, slope }) => ({
          name: tee.name,
          color: tee.color,
          rating,
          slope,
          yardages: tee.yardages,
        })),
      });
      if (!result.ok) {
        setTeeMetaError(result.error);
        return;
      }

      setPendingTeeMetaDraft(null);
      setTeeMetaInputs([]);
      setTeeMetaError(null);
      resetSyncedTees(result.tees);
      router.refresh();
    });
  };

  const onReplaceUnknownTee = () => {
    if (!placeholderTee?.id || !selectedReplacementSourceTeeId) return;

    form.clearErrors("root.server");
    startReplaceTeeTransition(async () => {
      const result = await replacePlaceholderTeeWithExistingTee({
        courseId: course.id,
        placeholderTeeId: placeholderTee.id!,
        sourceTeeId: Number(selectedReplacementSourceTeeId),
      });
      if (!result.ok) {
        form.setError("root.server", {
          type: "server",
          message: result.error,
        });
        return;
      }

      setReplacementSourceTeeId("");
      resetSyncedTees(result.tees);
      router.refresh();
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-6"
      >
        {serverError ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverError}
          </p>
        ) : null}

        <section className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Pebble Beach Golf Links" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="handle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Handle</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="pebble-beach" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="imgUrl"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <ImageUploadField
                      value={field.value || null}
                      onChange={(url) => field.onChange(url ?? "")}
                      pathPrefix={`courses/${course.handle}`}
                      aspectRatio={16 / 9}
                      variant="wide"
                      title="Course image"
                      description="Choose a nice landscape photo"
                      onUploadingChange={setIsUploading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="scorecardImgUrl"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <ImageUploadField
                      value={field.value || null}
                      onChange={onScorecardImageChange}
                      pathPrefix={`courses/${course.handle}/scorecards`}
                      variant="freeform"
                      skipCrop
                      fallback="Upload a photo of the scorecard"
                      title="Scorecard image"
                      description="Crop to show only the table"
                      onUploadingChange={setIsUploading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">Scorecard</h2>

          {teesError ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {teesError}
            </p>
          ) : null}

          {pendingTeeMetaDraft ? (
            <div className="flex flex-col gap-3 rounded-md border border-amber-400/50 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <p>
                We couldn&apos;t find rating and slope values for every new tee.
                Enter them to save those tee yardages.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {pendingTeeMetaDraft.tees.map((tee, i) => {
                  const meta = teeMetaInputs[i] ?? { rating: "", slope: "" };
                  return (
                    <div
                      key={`${tee.name}-${i}`}
                      className="flex flex-col gap-3 rounded-md border bg-background p-3 text-foreground"
                    >
                      <div className="text-sm font-medium">{tee.name}</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`edit-tee-${i}-rating`}>Rating</Label>
                          <Input
                            id={`edit-tee-${i}-rating`}
                            type="number"
                            inputMode="decimal"
                            min="0.1"
                            step="0.1"
                            placeholder="68.9"
                            value={meta.rating}
                            onChange={(e) =>
                              setTeeMetaInputs((prev) => {
                                const next = [...prev];
                                next[i] = {
                                  ...(next[i] ?? { rating: "", slope: "" }),
                                  rating: e.target.value,
                                };
                                return next;
                              })
                            }
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`edit-tee-${i}-slope`}>Slope</Label>
                          <Input
                            id={`edit-tee-${i}-slope`}
                            type="number"
                            min={55}
                            max={155}
                            step={1}
                            placeholder="122"
                            value={meta.slope}
                            onChange={(e) =>
                              setTeeMetaInputs((prev) => {
                                const next = [...prev];
                                next[i] = {
                                  ...(next[i] ?? { rating: "", slope: "" }),
                                  slope: e.target.value,
                                };
                                return next;
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {teeMetaError ? (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {teeMetaError}
                </p>
              ) : null}
              <div className="flex justify-end">
                <Button
                  type="button"
                  disabled={isFinalizingTeeMeta}
                  onClick={onSubmitTeeMeta}
                >
                  {isFinalizingTeeMeta ? "Saving tees…" : "Save tee ratings"}
                </Button>
              </div>
            </div>
          ) : null}

          {placeholderTee?.id && replacementSourceTees.length > 0 ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex flex-col gap-2 sm:w-72">
                <Label>Replace Unknown with</Label>
                <Select
                  value={selectedReplacementSourceTeeId}
                  onValueChange={setReplacementSourceTeeId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select tee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {replacementSourceTees.map((tee) => (
                        <SelectItem key={tee.id} value={String(tee.id)}>
                          {tee.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={!selectedReplacementSourceTeeId || isReplacingTee}
                onClick={onReplaceUnknownTee}
              >
                {isReplacingTee ? "Replacing…" : "Replace Unknown"}
              </Button>
            </div>
          ) : null}

          {isDesktop ? (
            <div className="grid grid-cols-3 gap-2">
              {teeFields.map((field, index) => (
                <TeeEditCard
                  key={field.id}
                  control={form.control}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Select
                value={String(effectiveSelectedTeeIndex)}
                onValueChange={(value) => setSelectedTeeIndex(Number(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select tee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {teeFields.map((field, index) => (
                      <SelectItem key={field.id} value={String(index)}>
                        {watchedTees[index]?.name?.trim() || `Tee ${index + 1}`}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              {selectedTee ? (
                <TeeEditCard
                  control={form.control}
                  index={effectiveSelectedTeeIndex}
                />
              ) : null}
            </div>
          )}

          <div className="overflow-x-auto rounded-md border">
            <ScorecardTable
              control={form.control}
              selectedTeeIndex={
                isDesktop ? undefined : effectiveSelectedTeeIndex
              }
            />
          </div>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {confirmingDelete ? (
            <div className="flex w-full flex-col gap-3">
              <p className="text-sm font-medium">
                Are you sure? This permanently deletes this course.
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
                Delete course
              </Button>
              <Button asChild variant="outline" disabled={isPending}>
                <Link href={`/courses/${course.handle}`}>Cancel</Link>
              </Button>
              <Button type="submit" disabled={isPending || isUploading}>
                {isPending ? "Saving…" : "Save changes"}
              </Button>
            </>
          )}
        </div>
      </form>
    </Form>
  );
}
