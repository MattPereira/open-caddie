"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { createCourse, deleteDraftBlobs } from "../actions";
import {
  CourseCreateInputSchema,
  type CourseCreateInputValues,
} from "../schema";

export function CourseCreateForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isUploadingImg, setIsUploadingImg] = useState(false);
  const [isUploadingScorecard, setIsUploadingScorecard] = useState(false);
  // Tracks every blob URL uploaded during this session — including ones the
  // user replaced — so we can clean them up on cancel / after submit.
  const [uploadedUrls, setUploadedUrls] = useState<Set<string>>(() => new Set());

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
  const draftPrefix = useMemo(
    () => `courses/draft-${crypto.randomUUID()}`,
    [],
  );

  const form = useForm<CourseCreateInputValues>({
    resolver: zodResolver(CourseCreateInputSchema),
    defaultValues: { name: "", imgUrl: "", scorecardImgUrl: "" },
  });
  const serverError = form.formState.errors.root?.server?.message;

  const onSubmit = (values: CourseCreateInputValues) => {
    form.clearErrors("root.server");
    startTransition(async () => {
      const result = await createCourse(values);
      if (!result.ok) {
        form.setError("root.server", {
          type: "server",
          message: result.error,
        });
        return;
      }
      // Clean up any uploads that were replaced before save (the final two
      // URLs are now owned by the course row).
      const keep = new Set([values.imgUrl, values.scorecardImgUrl]);
      const stale = [...uploadedUrls].filter((url) => !keep.has(url));
      if (stale.length) {
        deleteDraftBlobs(stale).catch(() => {});
      }
      const target = result.sumCheckIssues.length
        ? `/courses/${result.handle}/edit`
        : `/courses/${result.handle}`;
      router.push(target);
      router.refresh();
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

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
                    pathPrefix={draftPrefix}
                    aspectRatio={16 / 9}
                    variant="wide"
                    title="Course image"
                    description="Choose a nice landscape photo"
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
                    pathPrefix={draftPrefix}
                    variant="freeform"
                    aspectRatio={16 / 9}
                    fallback="Upload a photo of the scorecard"
                    title="Scorecard image"
                    description="Crop to show only the table"
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
            size="lg"
            disabled={isPending}
            onClick={onCancel}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="lg"
            disabled={isPending || isUploading}
            className="flex-1 sm:flex-none"
          >
            {isPending ? "Submitting…" : "Submit"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
