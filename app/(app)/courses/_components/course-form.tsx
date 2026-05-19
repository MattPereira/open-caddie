"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
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
import { ImageUploadField } from "@/components/image-upload-field";
import { Input } from "@/components/ui/input";
import { deleteCourse, updateCourse } from "../actions";
import {
  CourseFormSchema,
  type CourseFormValues,
  type TeeFormValues,
} from "../schema";
import type { CourseForEdit, CourseForEditTee } from "@/db/queries/courses";

type CourseFormProps = {
  course: CourseForEdit;
};

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

type HolesSectionProps = {
  control: import("react-hook-form").Control<CourseFormValues>;
};

function HolesSection({ control }: HolesSectionProps) {
  const holes = useWatch({ control, name: "holes" }) as CourseFormValues["holes"];
  const outPar = sumPars(holes, 0, 9);
  const inPar = sumPars(holes, 9, 18);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <HoleNineCard
        control={control}
        title="Front"
        startIndex={0}
        endIndex={9}
        subtotalLabel="Out"
        subtotalPar={outPar}
      />
      <HoleNineCard
        control={control}
        title="Back"
        startIndex={9}
        endIndex={18}
        subtotalLabel="In"
        subtotalPar={inPar}
      />
    </div>
  );
}

type HoleNineCardProps = {
  control: import("react-hook-form").Control<CourseFormValues>;
  title: string;
  startIndex: number;
  endIndex: number;
  subtotalLabel: string;
  subtotalPar: number;
};

function HoleNineCard({
  control,
  title,
  startIndex,
  endIndex,
  subtotalLabel,
  subtotalPar,
}: HoleNineCardProps) {
  return (
    <section className="flex flex-col gap-2 rounded-md border p-3">
        <div className="grid grid-cols-[5rem_1fr_1fr] items-center gap-2 text-xs font-medium">
          <span className="text-sm text-muted-foreground">{title}</span>
          <span>Par</span>
          <span>Handicap</span>
        </div>

        {Array.from({ length: endIndex - startIndex }, (_, i) => {
          const index = startIndex + i;
          const hole = index + 1;
          return (
            <div
              key={hole}
              className="grid grid-cols-[5rem_1fr_1fr] items-start gap-2"
            >
              <div className="pt-2 text-sm font-medium">Hole {hole}</div>

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
                name={`holes.${index}.handicap`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sr-only">
                      Hole {hole} handicap
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={18}
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
        })}

        <div className="grid grid-cols-[5rem_1fr_1fr] items-start gap-2">
          <div className="pt-2 text-sm font-medium">{subtotalLabel}</div>
          <Input
            type="number"
            disabled
            value={subtotalPar || ""}
            readOnly
            className="text-center"
          />
          <div />
        </div>
    </section>
  );
}

export function CourseForm({ course }: CourseFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(CourseFormSchema),
    defaultValues: toFormValues(course),
  });
  const serverError = form.formState.errors.root?.server?.message;
  const teesError = form.formState.errors.tees?.root?.message;

  const { fields: teeFields } = useFieldArray({
    control: form.control,
    name: "tees",
  });

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
                      pathPrefix={`courses/${course.id}`}
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
                      onChange={(url) => field.onChange(url ?? "")}
                      pathPrefix={`courses/${course.id}`}
                      variant="freeform"
                      aspectRatio={16 / 9}
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
          <h2 className="text-lg font-semibold">Tees</h2>

          {teesError ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {teesError}
            </p>
          ) : null}

          <div className="flex flex-col gap-4">
            {teeFields.map((field, index) => (
              <div
                key={field.id}
                className="flex flex-col gap-3 rounded-md border p-3"
              >
                <FormField
                  control={form.control}
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
                  control={form.control}
                  name={`tees.${index}.color`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="blue" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
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
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
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
                </div>
              </div>
            ))}
          </div>
        </section>

        <HolesSection control={form.control} />

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
