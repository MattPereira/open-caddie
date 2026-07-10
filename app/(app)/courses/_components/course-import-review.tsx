"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import type { CourseScorecardImportView } from "@/lib/course-scorecard-import";
import {
  cancelNewCourseScorecardImport,
  continueNewCourseScorecardImport,
} from "../actions";

export function CourseImportReview({
  initialImport,
}: {
  initialImport: CourseScorecardImportView;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [metadata, setMetadata] = useState<Record<string, { rating: string; slope: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const teePrompts = initialImport.prompts.filter(
    (prompt): prompt is Extract<typeof prompt, { kind: "tee_metadata" }> => prompt.kind === "tee_metadata",
  );
  const warningPrompts = initialImport.prompts.filter(
    (prompt): prompt is Extract<typeof prompt, { kind: "warning_acknowledgement" }> => prompt.kind === "warning_acknowledgement",
  );

  const submit = () => {
    const teeMetadata: Record<string, { rating: number; slope: number }> = {};
    for (const prompt of teePrompts) {
      const answer = metadata[prompt.id];
      const rating = Number(answer?.rating);
      const slope = Number(answer?.slope);
      if (!Number.isFinite(rating) || rating <= 0 || !Number.isInteger(slope) || slope < 55 || slope > 155) {
        setError(`Enter a valid rating and slope for ${prompt.teeName}.`);
        return;
      }
      teeMetadata[prompt.id] = { rating, slope };
    }
    startTransition(async () => {
      const result = await continueNewCourseScorecardImport({
        importId: initialImport.id,
        expectedRevision: initialImport.revision,
        teeMetadata,
        acknowledgeWarnings: warningPrompts.map((prompt) => prompt.warning),
      });
      if (result.outcome === "published") {
        router.push(`/courses/${result.handle}`);
        router.refresh();
        return;
      }
      if (result.outcome === "paused") {
        router.refresh();
        return;
      }
      setError(result.outcome === "rejected" ? result.error : "Import was cancelled.");
    });
  };

  const cancel = () => {
    startTransition(async () => {
      const result = await cancelNewCourseScorecardImport({
        importId: initialImport.id,
        expectedRevision: initialImport.revision,
      });
      if (result.outcome === "cancelled") router.push("/courses");
      else setError(result.outcome === "rejected" ? result.error : "Could not cancel import.");
    });
  };

  return (
    <div className="mt-6 flex max-w-xl flex-col gap-6">
      {teePrompts.map((prompt) => {
        const answer = metadata[prompt.id] ?? { rating: "", slope: "" };
        return (
          <div key={prompt.id} className="rounded-md border p-4">
            <p className="mb-3 text-sm font-medium">{prompt.teeName}</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor={`${prompt.id}-rating`}>Rating</Label><Input id={`${prompt.id}-rating`} type="number" value={answer.rating} onChange={(event) => setMetadata((current) => ({ ...current, [prompt.id]: { ...answer, rating: event.target.value } }))} /></div>
              <div><Label htmlFor={`${prompt.id}-slope`}>Slope</Label><Input id={`${prompt.id}-slope`} type="number" value={answer.slope} onChange={(event) => setMetadata((current) => ({ ...current, [prompt.id]: { ...answer, slope: event.target.value } }))} /></div>
            </div>
          </div>
        );
      })}
      {warningPrompts.length > 0 ? <p className="rounded-md border border-amber-400/50 bg-amber-50 p-3 text-sm text-amber-900">Submitting acknowledges {warningPrompts.length} scorecard warning(s).</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-3"><Button onClick={submit} disabled={isPending}>{isPending ? <><Spinner /> Saving…</> : "Publish course"}</Button><Button variant="outline" onClick={cancel} disabled={isPending}>Cancel import</Button></div>
    </div>
  );
}
