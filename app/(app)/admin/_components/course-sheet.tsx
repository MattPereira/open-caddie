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
import { ImageUploadField } from "@/components/image-upload-field";
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
import { createCourse, deleteCourse, updateCourse } from "../actions";
import { CourseFormSchema, type CourseFormValues } from "../schema";

export type AdminCourseHole = {
  courseId: number;
  hole: number;
  par: number;
  handicap: number;
};

export type AdminCourse = {
  id: number;
  handle: string;
  name: string;
  rating: string;
  slope: number;
  imgUrl: string | null;
  holes: AdminCourseHole[];
};

type CourseSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  course?: AdminCourse;
};

const defaultHoles = Array.from({ length: 18 }, (_, index) => ({
  hole: index + 1,
  par: "" as const,
  handicap: "" as const,
}));

const emptyDefaults: CourseFormValues = {
  handle: "",
  name: "",
  rating: "",
  slope: "",
  imgUrl: "",
  holes: defaultHoles,
};

function toFormValues(course?: AdminCourse): CourseFormValues {
  if (!course) return emptyDefaults;

  const holesByNumber = new Map(course.holes.map((hole) => [hole.hole, hole]));

  return {
    handle: course.handle,
    name: course.name,
    rating: course.rating,
    slope: course.slope,
    imgUrl: course.imgUrl ?? "",
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

export function CourseSheet({
  open,
  onOpenChange,
  mode,
  course,
}: CourseSheetProps) {
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

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(course));
    }
  }, [open, course, form]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      form.clearErrors("root.server");
      setDeleteError(null);
      setConfirmingDelete(false);
    }

    onOpenChange(nextOpen);
  };

  const onDelete = () => {
    if (!course) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteCourse(course.id);
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      setConfirmingDelete(false);
      handleOpenChange(false);
    });
  };

  const onSubmit = (values: CourseFormValues) => {
    form.clearErrors("root.server");
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createCourse(values)
          : await updateCourse({ ...values, id: course!.id });

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

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex h-dvh w-full flex-col gap-0 overflow-hidden sm:max-w-xl">
        <SheetHeader className="shrink-0">
          <SheetTitle>
            {mode === "create" ? "Add course" : "Edit course"}
          </SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Create a new course."
              : "Update course details."}
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

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="rating"
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
                    name="slope"
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

                {mode === "edit" && course ? (
                  <FormField
                    control={form.control}
                    name="imgUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Course image</FormLabel>
                        <FormControl>
                          <ImageUploadField
                            value={field.value || null}
                            onChange={(url) => field.onChange(url ?? "")}
                            pathPrefix={`courses/${course.id}`}
                            aspectRatio={16 / 9}
                            variant="wide"
                            onUploadingChange={setIsUploading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    You can upload a course image after the course is created.
                  </p>
                )}

                <div className="flex flex-col gap-3 rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-medium">Scorecard</h2>
                    <div className="grid grid-cols-2 gap-2 text-xs font-medium text-muted-foreground">
                      <span className="w-20">Par</span>
                      <span className="w-20">Handicap</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {defaultHoles.map((hole, index) => (
                      <div
                        key={hole.hole}
                        className="grid grid-cols-[4rem_1fr_1fr] items-start gap-2"
                      >
                        <div className="pt-2 text-sm font-medium">
                          Hole {hole.hole}
                        </div>

                        <FormField
                          control={form.control}
                          name={`holes.${index}.par`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="sr-only">
                                Hole {hole.hole} par
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={2}
                                  max={7}
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
                          name={`holes.${index}.handicap`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="sr-only">
                                Hole {hole.hole} handicap
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={1}
                                  max={18}
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
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <SheetFooter className="shrink-0">
              {confirmingDelete && mode === "edit" && course ? (
                <div className="flex flex-col gap-3">
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
                  <Button type="submit" disabled={isPending || isUploading}>
                    {isPending
                      ? "Saving…"
                      : mode === "create"
                        ? "Create course"
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
                  {mode === "edit" && course ? (
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
