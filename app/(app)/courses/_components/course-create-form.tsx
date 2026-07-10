"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
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
import { Spinner } from "@/components/ui/spinner";
import { ImageUploadField } from "@/components/image-upload-field";
import { ParsingOverlay } from "@/components/parsing-overlay";
import { Input } from "@/components/ui/input";
import { courseHandleFromName } from "@/lib/course-handle";
import { startCourseScorecardImport } from "../actions";
import {
  CourseCreateInputSchema,
  type CourseCreateInputValues,
} from "../schema";

export function CourseCreateForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isUploadingImg, setIsUploadingImg] = useState(false);
  const [isUploadingScorecard, setIsUploadingScorecard] = useState(false);
  // Stable draft prefix for both blob uploads. The blob URL persists, so the
  // prefix is internal organization only — never user-visible.
  const draftPrefix = useMemo(() => `courses/draft-${crypto.randomUUID()}`, []);

  const form = useForm<CourseCreateInputValues>({
    resolver: zodResolver(CourseCreateInputSchema),
    defaultValues: { name: "", imgUrl: "", scorecardImgUrl: "" },
  });
  const watchedName = useWatch({ control: form.control, name: "name" });
  const courseHandle = courseHandleFromName(watchedName);
  const hasCourseHandle = courseHandle.length > 0;
  const uploadPathPrefix = courseHandle
    ? `courses/${courseHandle}`
    : draftPrefix;
  const serverError = form.formState.errors.root?.server?.message;

  const finalizeAndRedirect = (handle: string) => {
    router.push(`/courses/${handle}`);
    router.refresh();
  };

  const onSubmit = (values: CourseCreateInputValues) => {
    form.clearErrors("root.server");
    startTransition(async () => {
      const result = await startCourseScorecardImport(values);
      if (result.outcome === "published") {
        finalizeAndRedirect(result.handle);
        return;
      }
      if (result.outcome === "paused") {
        router.push(`/courses/imports/${result.import.id}`);
        return;
      }
      form.setError("root.server", {
        type: "server",
        message: result.outcome === "rejected" ? result.error : "Course import was cancelled.",
      });
    });
  };

  const onCancel = () => {
    router.push("/courses");
  };

  const isUploading = isUploadingImg || isUploadingScorecard;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-6"
      >
        <ParsingOverlay
          active={isPending}
          title="Setting up your course"
          messages={[
            "Reading the scorecard…",
            "Mapping out the tees…",
            "Measuring hole yardages…",
            "Noting pars and handicaps…",
          ]}
        />

        {serverError ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverError}
          </p>
        ) : null}

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="md:w-1/2">
              <FormLabel>Course name</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Pebble Beach Golf Links" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-6">
          <FormField
            control={form.control}
            name="imgUrl"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <ImageUploadField
                    value={field.value || null}
                    onChange={(url) => {
                      field.onChange(url ?? "");
                    }}
                    pathPrefix={uploadPathPrefix}
                    aspectRatio={16 / 9}
                    variant="wide"
                    title="Course image"
                    description={
                      hasCourseHandle
                        ? "Choose a nice landscape photo"
                        : "Enter a course name first so the image is saved under the course handle"
                    }
                    fallback="Upload a photo of the course"
                    disabled={!hasCourseHandle}
                    onUploadingChange={setIsUploadingImg}
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
                    onChange={(url) => {
                      field.onChange(url ?? "");
                    }}
                    pathPrefix={`${uploadPathPrefix}/scorecards`}
                    variant="freeform"
                    fallback="Upload a photo of blank scorecard"
                    title="Scorecard image"
                    description={
                      hasCourseHandle
                        ? "Crop to show only the table"
                        : "Enter a course name first so the scorecard is saved under the course handle"
                    }
                    disabled={!hasCourseHandle}
                    onUploadingChange={setIsUploadingScorecard}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-row justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            size="xl"
            disabled={isPending}
            onClick={onCancel}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="xl"
            disabled={isPending || isUploading}
            className="flex-1 sm:flex-none"
          >
            {isPending ? (
              <>
                <Spinner />
                Submitting…
              </>
            ) : (
              "Submit"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
