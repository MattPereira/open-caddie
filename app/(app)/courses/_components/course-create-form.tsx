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
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ImageUploadField } from "@/components/image-upload-field";
import { ParsingOverlay } from "@/components/parsing-overlay";
import { Input } from "@/components/ui/input";
import { courseHandleFromName } from "@/lib/course-handle";
import {
  continueNewCourseScorecardImport,
  deleteDraftBlobs,
  startNewCourseScorecardImport,
  type NewCourseImportResult,
} from "../actions";
import {
  CourseCreateInputSchema,
  type CourseCreateInputValues,
} from "../schema";

type TeeMetaInputs = Array<{ rating: string; slope: string }>;

export function CourseCreateForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isUploadingImg, setIsUploadingImg] = useState(false);
  const [isUploadingScorecard, setIsUploadingScorecard] = useState(false);
  const [pendingImport, setPendingImport] = useState<Extract<NewCourseImportResult, { outcome: "paused" }> | null>(null);
  const [teeMetaInputs, setTeeMetaInputs] = useState<TeeMetaInputs>([]);
  const [teeMetaError, setTeeMetaError] = useState<string | null>(null);
  // Tracks every blob URL uploaded during this session — including ones the
  // user replaced — so we can clean them up on cancel / after submit.
  const [uploadedUrls, setUploadedUrls] = useState<Set<string>>(
    () => new Set(),
  );

  const trackUpload = (url: string | null) => {
    if (!url) return;
    setUploadedUrls((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  };

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

  const finalizeAndRedirect = (
    values: { imgUrl: string; scorecardImgUrl: string },
    handle: string,
  ) => {
    const keep = new Set([values.imgUrl, values.scorecardImgUrl]);
    const stale = [...uploadedUrls].filter((url) => !keep.has(url));
    if (stale.length) {
      deleteDraftBlobs(stale).catch(() => {});
    }
    router.push(`/courses/${handle}`);
    router.refresh();
  };

  const onSubmit = (values: CourseCreateInputValues) => {
    form.clearErrors("root.server");
    startTransition(async () => {
      const result = await startNewCourseScorecardImport(values);
      if (result.outcome === "published") {
        finalizeAndRedirect(values, result.handle);
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

  const onSubmitTeeMeta = () => {
    if (!pendingImport) return;
    setTeeMetaError(null);

    const metadataPrompts = pendingImport.import.prompts.filter(
      (prompt): prompt is Extract<typeof prompt, { kind: "tee_metadata" }> => prompt.kind === "tee_metadata",
    );
    const finalizedTees = metadataPrompts.map((prompt, i) => {
      const rating = Number(teeMetaInputs[i]?.rating);
      const slope = Number(teeMetaInputs[i]?.slope);
      return { prompt, rating, slope };
    });

    for (let i = 0; i < finalizedTees.length; i++) {
      const { prompt, rating, slope } = finalizedTees[i];
      if (!Number.isFinite(rating) || rating <= 0) {
        setTeeMetaError(`Enter a valid rating for ${prompt.teeName}.`);
        return;
      }
      if (!Number.isInteger(slope) || slope < 55 || slope > 155) {
        setTeeMetaError(`Slope for ${prompt.teeName} must be between 55 and 155.`);
        return;
      }
    }

    startTransition(async () => {
      const result = await continueNewCourseScorecardImport({
        importId: pendingImport.import.id,
        expectedRevision: pendingImport.import.revision,
        teeMetadata: Object.fromEntries(
          finalizedTees.map(({ prompt, rating, slope }) => [prompt.id, { rating, slope }]),
        ),
        acknowledgeWarnings: pendingImport.import.prompts
          .filter((prompt) => prompt.kind === "warning_acknowledgement")
          .map((prompt) => prompt.warning),
      });
      if (result.outcome === "published") {
        finalizeAndRedirect(form.getValues(), result.handle);
        return;
      }
      if (result.outcome === "paused") {
        setPendingImport(result);
        return;
      }
      setTeeMetaError(result.outcome === "rejected" ? result.error : "Course import was cancelled.");
    });
  };

  const onCancel = () => {
    const stale = [...uploadedUrls];
    if (stale.length) {
      deleteDraftBlobs(stale).catch(() => {});
    }
    router.push("/courses");
  };

  const isUploading = isUploadingImg || isUploadingScorecard;

  if (pendingImport) {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-md border border-amber-400/50 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          We couldn&apos;t find a rating and slope for every tee on the
          scorecard image. Many courses print these on the back of the card.
          Enter them below to finish creating the course.
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {pendingImport.import.prompts
            .filter((prompt) => prompt.kind === "tee_metadata")
            .map((tee, i) => {
            const meta = teeMetaInputs[i] ?? { rating: "", slope: "" };
            return (
              <div
                key={tee.id}
                className="flex flex-col gap-3 rounded-md border p-3"
              >
                <div className="text-sm font-medium">{tee.teeName}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`tee-${i}-rating`}>Rating</Label>
                    <Input
                      id={`tee-${i}-rating`}
                      type="number"
                      inputMode="decimal"
                      min="0.1"
                      step="0.1"
                      placeholder="68.9"
                      value={meta.rating}
                      onChange={(e) =>
                        setTeeMetaInputs((prev) => {
                          const next = [...prev];
                          next[i] = { ...next[i], rating: e.target.value };
                          return next;
                        })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`tee-${i}-slope`}>Slope</Label>
                    <Input
                      id={`tee-${i}-slope`}
                      type="number"
                      min={55}
                      max={155}
                      step={1}
                      placeholder="122"
                      value={meta.slope}
                      onChange={(e) =>
                        setTeeMetaInputs((prev) => {
                          const next = [...prev];
                          next[i] = { ...next[i], slope: e.target.value };
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

        <div className="flex flex-row justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isPending}
            onClick={() => {
              setPendingImport(null);
              setTeeMetaInputs([]);
              setTeeMetaError(null);
            }}
            className="flex-1 sm:flex-none"
          >
            Back
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={isPending}
            onClick={onSubmitTeeMeta}
            className="flex-1 sm:flex-none"
          >
            {isPending ? (
              <>
                <Spinner />
                Submitting…
              </>
            ) : (
              "Finish creating course"
            )}
          </Button>
        </div>
      </div>
    );
  }

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
                      trackUpload(url);
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
                      trackUpload(url);
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
