"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ImageUploadField } from "@/components/image-upload-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import type { CourseScorecardImportView } from "@/lib/course-scorecard-import";
import {
  cancelNewCourseScorecardImport,
  continueNewCourseScorecardImport,
  retryNewCourseScorecardImport,
  replaceNewCourseScorecardImport,
} from "../actions";

function selectedExistingTeeId(value: { kind: "new" } | { kind: "existing"; teeId: number } | undefined) {
  return value?.kind === "existing" ? String(value.teeId) : "new";
}

function selectedPlaceholderTeeId(value: { kind: "keep" } | { kind: "map"; teeId: string } | undefined) {
  return value?.kind === "map" ? value.teeId : "keep";
}

export function CourseImportReview({
  initialImport,
}: {
  initialImport: CourseScorecardImportView;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [metadata, setMetadata] = useState<Record<string, { rating: string; slope: string }>>({});
  const [teeNames, setTeeNames] = useState<Record<string, string>>({});
  const [teeYardages, setTeeYardages] = useState<Record<string, string>>({});
  const [holes, setHoles] = useState<Record<string, { hole: string; par: string; handicap: string }>>({});
  const [excludedTees, setExcludedTees] = useState<Set<string>>(() => new Set());
  const [teeResolutions, setTeeResolutions] = useState<Record<string, { kind: "new" } | { kind: "existing"; teeId: number }>>({});
  const [placeholderResolutions, setPlaceholderResolutions] = useState<Record<string, { kind: "keep" } | { kind: "map"; teeId: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const teePrompts = initialImport.prompts.filter(
    (prompt): prompt is Extract<typeof prompt, { kind: "tee_metadata" }> => prompt.kind === "tee_metadata",
  );
  const warningPrompts = initialImport.prompts.filter(
    (prompt): prompt is Extract<typeof prompt, { kind: "warning_acknowledgement" }> => prompt.kind === "warning_acknowledgement",
  );
  const needsParseRetry = initialImport.prompts.some(
    (prompt) => prompt.kind === "retry_parsing",
  );
  const matchPrompts = initialImport.prompts.filter(
    (prompt): prompt is Extract<typeof prompt, { kind: "tee_match" }> => prompt.kind === "tee_match",
  );
  const placeholderPrompts = initialImport.prompts.filter(
    (prompt): prompt is Extract<typeof prompt, { kind: "placeholder_tee" }> => prompt.kind === "placeholder_tee",
  );

  const submit = () => {
    const teeMetadata: Record<string, { rating: number; slope: number }> = {};
    for (const prompt of teePrompts) {
      const answer = metadata[prompt.id];
      if (!answer?.rating && !answer?.slope) continue;
      const rating = Number(answer?.rating);
      const slope = Number(answer?.slope);
      if (!Number.isFinite(rating) || rating <= 0 || !Number.isInteger(slope) || slope < 55 || slope > 155) {
        setError(`Enter a valid rating and slope for ${prompt.teeName}.`);
        return;
      }
      teeMetadata[prompt.id] = { rating, slope };
    }
    const teeCorrections = Object.fromEntries(
      initialImport.parsed.tees.flatMap((tee) => {
        const name = teeNames[tee.id];
        const yardages = teeYardages[tee.id];
        const correction = {
          ...(name != null && name !== tee.name ? { name } : {}),
          ...(yardages != null && yardages !== tee.yardages.join(", ") ? { yardages: yardages.split(",").map((value) => Number(value.trim())) } : {}),
        };
        return Object.keys(correction).length ? [[tee.id, correction]] : [];
      }),
    );
    const holeCorrections = Object.fromEntries(initialImport.parsed.holes.flatMap((hole) => {
      const value = holes[hole.id];
      const correction = {
        ...(value?.hole != null && Number(value.hole) !== hole.hole ? { hole: Number(value.hole) } : {}),
        ...(value?.par != null && Number(value.par) !== hole.par ? { par: Number(value.par) } : {}),
        ...(value?.handicap != null && Number(value.handicap) !== hole.handicap ? { handicap: Number(value.handicap) } : {}),
      };
      return Object.keys(correction).length ? [[hole.id, correction]] : [];
    }));
    startTransition(async () => {
      const result = await continueNewCourseScorecardImport({
        importId: initialImport.id,
        expectedRevision: initialImport.revision,
        teeMetadata,
        acknowledgeWarnings: warningPrompts.map((prompt) => prompt.id),
        corrections: Object.keys(teeCorrections).length || Object.keys(holeCorrections).length ? { tees: teeCorrections, holes: holeCorrections } : undefined,
        excludeTees: [...excludedTees],
        teeResolutions,
        placeholderResolutions,
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

  const retryParsing = () => {
    startTransition(async () => {
      const result = await retryNewCourseScorecardImport({
        importId: initialImport.id,
        expectedRevision: initialImport.revision,
      });
      if (result.outcome === "published") {
        router.push(`/courses/${result.handle}`);
        return;
      }
      if (result.outcome === "paused") {
        router.refresh();
        return;
      }
      setError(result.outcome === "rejected" ? result.error : "Could not retry parsing.");
    });
  };

  const replaceScorecardImage = (stagedScorecardImageHandle: string | null) => {
    if (!stagedScorecardImageHandle) return;
    startTransition(async () => {
      const result = await replaceNewCourseScorecardImport({
        importId: initialImport.id,
        expectedRevision: initialImport.revision,
        stagedScorecardImageHandle,
      });
      if (result.outcome === "published") {
        router.push(`/courses/${result.handle}`);
        return;
      }
      if (result.outcome === "paused") {
        router.refresh();
        return;
      }
      setError(result.outcome === "rejected" ? result.error : "Could not replace scorecard image.");
    });
  };

  return (
    <div className="mt-6 flex max-w-xl flex-col gap-6">
      <section className="rounded-md border p-4">
        <h2 className="font-medium">Parsed tees</h2>
        <div className="mt-3 flex flex-col gap-3">
          {initialImport.parsed.tees.map((tee) => (
            <div key={tee.id} className="flex flex-wrap items-center gap-2">
              <Input aria-label={`${tee.name} tee name`} className="max-w-48" value={teeNames[tee.id] ?? tee.name} onChange={(event) => setTeeNames((current) => ({ ...current, [tee.id]: event.target.value }))} disabled={tee.excluded} />
              <Input aria-label={`${tee.name} yardages`} className="min-w-64 flex-1" value={teeYardages[tee.id] ?? tee.yardages.join(", ")} onChange={(event) => setTeeYardages((current) => ({ ...current, [tee.id]: event.target.value }))} disabled={tee.excluded} />
              <Button type="button" variant="outline" size="sm" disabled={tee.excluded || isPending} onClick={() => setExcludedTees((current) => new Set(current).add(tee.id))}>{tee.excluded || excludedTees.has(tee.id) ? "Excluded" : "Exclude"}</Button>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Correct names and comma-separated yardages here. Excluded tees will not be published.</p>
      </section>
      {matchPrompts.map((prompt) => (
        <section key={prompt.id} className="rounded-md border p-4">
          <Label htmlFor={prompt.id}>Match {prompt.teeName}</Label>
          <select id={prompt.id} className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-sm" value={selectedExistingTeeId(teeResolutions[`tee:${prompt.teeIndex}`])} onChange={(event) => setTeeResolutions((current) => ({ ...current, [`tee:${prompt.teeIndex}`]: event.target.value === "new" ? { kind: "new" } : { kind: "existing", teeId: Number(event.target.value) } }))}>
            <option value="new">Create new tee</option>
            {prompt.existingTeeIds.map((id) => <option key={id} value={id}>Existing tee #{id}</option>)}
          </select>
        </section>
      ))}
      {placeholderPrompts.map((prompt) => (
        <section key={prompt.id} className="rounded-md border p-4">
          <Label htmlFor={prompt.id}>Placeholder Tee #{prompt.teeId}</Label>
          <select id={prompt.id} className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-sm" value={selectedPlaceholderTeeId(placeholderResolutions[String(prompt.teeId)])} onChange={(event) => setPlaceholderResolutions((current) => ({ ...current, [String(prompt.teeId)]: event.target.value === "keep" ? { kind: "keep" } : { kind: "map", teeId: event.target.value } }))}>
            <option value="keep">Keep unchanged</option>
            {initialImport.parsed.tees.filter((tee) => !tee.excluded).map((tee) => <option key={tee.id} value={tee.id}>Map to {tee.name}</option>)}
          </select>
        </section>
      ))}
      <section className="rounded-md border p-4">
        <h2 className="font-medium">Parsed holes</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {initialImport.parsed.holes.map((hole) => {
            const value = holes[hole.id] ?? { hole: String(hole.hole), par: String(hole.par), handicap: String(hole.handicap) };
            return <div key={hole.id} className="flex items-center gap-2 text-sm"><Input aria-label={`Hole ${hole.hole} number`} className="w-16" type="number" value={value.hole} onChange={(event) => setHoles((current) => ({ ...current, [hole.id]: { ...value, hole: event.target.value } }))} /><Input aria-label={`Hole ${hole.hole} par`} className="w-16" type="number" value={value.par} onChange={(event) => setHoles((current) => ({ ...current, [hole.id]: { ...value, par: event.target.value } }))} /><Input aria-label={`Hole ${hole.hole} handicap`} className="w-16" type="number" value={value.handicap} onChange={(event) => setHoles((current) => ({ ...current, [hole.id]: { ...value, handicap: event.target.value } }))} /></div>;
          })}
        </div>
      </section>
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
      {needsParseRetry ? <><p className="rounded-md border border-amber-400/50 bg-amber-50 p-3 text-sm text-amber-900">The scorecard could not be parsed. Retry after confirming the image is available, or replace it.</p><ImageUploadField value={null} onChange={replaceScorecardImage} pathPrefix={`courses/${initialImport.target.handle}/scorecards`} variant="freeform" title="Replace scorecard image" disabled={isPending} /></> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-3">{needsParseRetry ? <Button onClick={retryParsing} disabled={isPending}>{isPending ? <><Spinner /> Retrying…</> : "Retry parsing"}</Button> : <Button onClick={submit} disabled={isPending}>{isPending ? <><Spinner /> Saving…</> : "Publish course"}</Button>}<Button variant="outline" onClick={cancel} disabled={isPending}>Cancel import</Button></div>
    </div>
  );
}
