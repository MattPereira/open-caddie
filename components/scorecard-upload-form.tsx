"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploadField } from "@/components/image-upload-field";
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
  players: ScorecardPlayer[];
  uploadPathPrefix: string;
};

export function ScorecardUploadForm({
  action,
  cancelHref,
  players,
  uploadPathPrefix,
}: ScorecardUploadFormProps) {
  const [state, formAction] = useActionState(action, { error: null });
  const [scorecardImgUrl, setScorecardImgUrl] = useState<string | null>(null);
  const [isUploadingScorecard, setIsUploadingScorecard] = useState(false);
  const [selectedRoundIds, setSelectedRoundIds] = useState<Set<number>>(
    new Set(),
  );
  const canSubmit =
    scorecardImgUrl != null &&
    selectedRoundIds.size > 0 &&
    !isUploadingScorecard;

  const toggleRound = (roundId: number) => {
    setSelectedRoundIds((prev) => {
      const next = new Set(prev);
      if (next.has(roundId)) next.delete(roundId);
      else next.add(roundId);
      return next;
    });
  };

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.error ? (
        <Alert variant="error">
          <AlertTitle>Upload failed</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">Who&apos;s on this card?</h2>
          <p className="text-sm text-muted-foreground">
            Select the players whose scores are on this scorecard.
          </p>
        </div>

        {players.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
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
                    size="sm"
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
          value={scorecardImgUrl ?? ""}
        />
        <ImageUploadField
          value={scorecardImgUrl}
          onChange={setScorecardImgUrl}
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
          <FieldLabel htmlFor="additional-context">
            Parsing notes
          </FieldLabel>
          <Textarea
            id="additional-context"
            name="additionalContext"
            maxLength={1000}
            placeholder="Example: Player rows are Matt, Alex, Jamie top to bottom."
            rows={3}
          />
          <FieldDescription>
            Optional row order, nicknames, or handwriting hints for this card.
          </FieldDescription>
        </Field>
      </FieldGroup>

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline">
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
    <Button type="submit" disabled={!canSubmit || pending}>
      {pending ? "Parsing..." : "Upload scorecard"}
    </Button>
  );
}
