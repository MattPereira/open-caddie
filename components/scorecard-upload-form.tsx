"use client";

import Link from "next/link";
import {
  useActionState,
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useFormStatus } from "react-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploadField } from "@/components/image-upload-field";
import { ParsingOverlay } from "@/components/parsing-overlay";
import { PlayerCard } from "@/components/player-card";
import type { UploadRoundScorecardState } from "@/lib/actions/upload-round-scorecard";

export type ScorecardPlayer = {
  roundId: number;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  image: string | null;
};

type ScorecardUploadFormProps = {
  action: (
    state: UploadRoundScorecardState,
    formData: FormData,
  ) => Promise<UploadRoundScorecardState>;
  cancelHref: string;
  draftStorageKey: string;
  players: ScorecardPlayer[];
  uploadPathPrefix: string;
};

type ScorecardUploadDraft = {
  scorecardImgUrl: string | null;
  selectedRoundIds: number[];
  additionalContext: string;
};

const emptyDraft: ScorecardUploadDraft = {
  scorecardImgUrl: null,
  selectedRoundIds: [],
  additionalContext: "",
};

const subscribeToStorage = (callback: () => void) => {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
};

const parseDraft = (
  raw: string | null,
  validRoundIds: Set<number>,
): ScorecardUploadDraft => {
  if (!raw) return emptyDraft;

  try {
    const draft = JSON.parse(raw) as Partial<ScorecardUploadDraft>;
    return {
      scorecardImgUrl:
        typeof draft.scorecardImgUrl === "string"
          ? draft.scorecardImgUrl
          : null,
      selectedRoundIds: Array.isArray(draft.selectedRoundIds)
        ? draft.selectedRoundIds.filter(
            (roundId) =>
              Number.isInteger(roundId) && validRoundIds.has(roundId),
          )
        : [],
      additionalContext:
        typeof draft.additionalContext === "string"
          ? draft.additionalContext
          : "",
    };
  } catch {
    return emptyDraft;
  }
};

const isEmptyDraft = (draft: ScorecardUploadDraft) =>
  draft.scorecardImgUrl == null &&
  draft.selectedRoundIds.length === 0 &&
  draft.additionalContext.trim().length === 0;

export function ScorecardUploadForm({
  action,
  cancelHref,
  draftStorageKey,
  players,
  uploadPathPrefix,
}: ScorecardUploadFormProps) {
  const [state, formAction] = useActionState(action, { error: null });
  const [isUploadingScorecard, setIsUploadingScorecard] = useState(false);
  const validRoundIds = useMemo(
    () => new Set(players.map((player) => player.roundId)),
    [players],
  );
  const rawDraft = useSyncExternalStore(
    subscribeToStorage,
    () => window.localStorage.getItem(draftStorageKey),
    () => null,
  );
  const draft = useMemo(
    () => parseDraft(rawDraft, validRoundIds),
    [rawDraft, validRoundIds],
  );
  const selectedRoundIds = useMemo(
    () => new Set(draft.selectedRoundIds),
    [draft.selectedRoundIds],
  );
  const canSubmit =
    draft.scorecardImgUrl != null &&
    selectedRoundIds.size > 0 &&
    !isUploadingScorecard;

  const setDraft = useCallback(
    (next: ScorecardUploadDraft) => {
      if (isEmptyDraft(next)) {
        window.localStorage.removeItem(draftStorageKey);
      } else {
        window.localStorage.setItem(draftStorageKey, JSON.stringify(next));
      }
      window.dispatchEvent(new StorageEvent("storage"));
    },
    [draftStorageKey],
  );

  const toggleRound = (roundId: number) => {
    const next = new Set(draft.selectedRoundIds);
    if (next.has(roundId)) next.delete(roundId);
    else next.add(roundId);
    setDraft({ ...draft, selectedRoundIds: [...next] });
  };

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <FormPendingOverlay />

      {state.error ? (
        <Alert variant="error">
          <AlertTitle>Upload failed</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="font-medium">Choose players</h2>
        </div>

        {players.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-muted-foreground">
            No players are attached to this round yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {players.map((player) => {
              const selected = selectedRoundIds.has(player.roundId);
              return (
                <div
                  key={player.roundId}
                  className={
                    selected
                      ? "relative rounded-xl ring-2 ring-primary"
                      : "relative rounded-xl"
                  }
                >
                  <PlayerCard
                    player={{ ...player, email: null }}
                    size="default"
                    onClick={() => toggleRound(player.roundId)}
                  />
                  {selected ? (
                    <div className="pointer-events-none absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <HugeiconsIcon icon={Tick02Icon} size={14} />
                    </div>
                  ) : null}
                </div>
              );
            })}
            {players
              .filter((player) => selectedRoundIds.has(player.roundId))
              .map((player) => (
                <input
                  key={`selected-${player.roundId}`}
                  type="hidden"
                  name="roundId"
                  value={player.roundId}
                />
              ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <input
          type="hidden"
          name="scorecardImgUrl"
          value={draft.scorecardImgUrl ?? ""}
        />
        <ImageUploadField
          value={draft.scorecardImgUrl}
          onChange={(scorecardImgUrl) =>
            setDraft({ ...draft, scorecardImgUrl })
          }
          pathPrefix={uploadPathPrefix}
          variant="freeform"
          fallback="Upload a photo of the scorecard"
          title="Scorecard photo"
          description="Crop to show the score table and player rows"
          onUploadingChange={setIsUploadingScorecard}
        />
      </section>

      <FieldGroup>
        <Field>
          <FieldLabel className="text-base" htmlFor="additional-context">
            Parsing notes
          </FieldLabel>
          <Textarea
            id="additional-context"
            name="additionalContext"
            maxLength={1000}
            placeholder="Player rows are Matt, Alex, Jamie top to bottom."
            rows={3}
            value={draft.additionalContext}
            onChange={(event) =>
              setDraft({ ...draft, additionalContext: event.target.value })
            }
          />
        </Field>
      </FieldGroup>

      <div className="flex justify-end gap-2">
        <Button size="xl" asChild variant="outline">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        <SubmitButton canSubmit={canSubmit} />
      </div>
    </form>
  );
}

function SubmitButton({ canSubmit }: { canSubmit: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button size="xl" type="submit" disabled={!canSubmit || pending}>
      {pending ? (
        <>
          <Spinner />
          Parsing…
        </>
      ) : (
        "Submit"
      )}
    </Button>
  );
}

function FormPendingOverlay() {
  const { pending } = useFormStatus();
  return <ParsingOverlay active={pending} />;
}
