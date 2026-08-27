"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowLeft02Icon,
  Delete02Icon,
  PencilEdit02Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HoldToConfirmButton } from "@/components/shared/hold-to-confirm-button";
import type { TournamentPairing } from "@/lib/tournaments/queries";
import {
  createPairing,
  deletePairing,
  renamePairing,
} from "../../../actions";

type PairingsManagerProps = {
  tournamentId: number;
  pairings: TournamentPairing[];
  backHref: string;
};

export function PairingsManager({
  tournamentId,
  pairings,
  backHref,
}: PairingsManagerProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      setEditingId(null);
      setDeletingId(null);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="lg"
          disabled={isPending}
          onClick={() => run(() => createPairing({ tournamentId }))}
        >
          <HugeiconsIcon icon={PlusSignIcon} data-icon="inline-start" />
          Add pairing
        </Button>
        <Button asChild variant="outline" size="lg" className="ml-auto">
          <Link href={backHref}>
            <HugeiconsIcon icon={ArrowLeft02Icon} data-icon="inline-start" />
            Tournament
          </Link>
        </Button>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {pairings.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No pairings yet. Add one to start grouping the field.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pairings.map((pairing) => (
            <li
              key={pairing.id}
              className="flex flex-col gap-3 rounded-xl border px-4 py-3"
            >
              {editingId === pairing.id ? (
                <RenameForm
                  name={pairing.name}
                  isPending={isPending}
                  onCancelAction={() => setEditingId(null)}
                  onSubmitAction={(name) =>
                    run(() => renamePairing({ pairingId: pairing.id, name }))
                  }
                />
              ) : (
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-base font-medium">
                    {pairing.name}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    aria-label={`Rename ${pairing.name}`}
                    disabled={isPending}
                    onClick={() => {
                      setDeletingId(null);
                      setEditingId(pairing.id);
                    }}
                  >
                    <HugeiconsIcon icon={PencilEdit02Icon} aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Delete ${pairing.name}`}
                    disabled={isPending}
                    onClick={() => {
                      setEditingId(null);
                      setDeletingId(pairing.id);
                    }}
                  >
                    <HugeiconsIcon icon={Delete02Icon} aria-hidden />
                  </Button>
                </div>
              )}

              {deletingId === pairing.id ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="xl"
                    disabled={isPending}
                    onClick={() => setDeletingId(null)}
                  >
                    Cancel
                  </Button>
                  <HoldToConfirmButton
                    disabled={isPending}
                    idleLabel={
                      isPending ? "Deleting…" : `Hold to delete ${pairing.name}`
                    }
                    onConfirmAction={() =>
                      run(() => deletePairing({ pairingId: pairing.id }))
                    }
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RenameForm({
  name,
  isPending,
  onCancelAction,
  onSubmitAction,
}: {
  name: string;
  isPending: boolean;
  onCancelAction: () => void;
  onSubmitAction: (name: string) => void;
}) {
  const [value, setValue] = useState(name);

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmitAction(value);
      }}
    >
      <Input
        autoFocus
        aria-label="Pairing name"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={isPending}
      />
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={isPending}
        onClick={onCancelAction}
      >
        Cancel
      </Button>
      <Button type="submit" size="lg" disabled={isPending || !value.trim()}>
        {isPending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
