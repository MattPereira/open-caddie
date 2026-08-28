"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Delete02Icon,
  PencilEdit02Icon,
  PlusSignIcon,
  UserSwitchIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HoldToConfirmButton } from "@/components/shared/hold-to-confirm-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { displayName } from "@/lib/players/player-name";
import { PAIRING_MAX_MEMBERS } from "@/lib/tournaments/pairings";
import type {
  TournamentPairing,
  TournamentPairingMember,
} from "@/lib/tournaments/queries";
import type { ActionResult } from "../../../actions";
import {
  assignRoundToPairing,
  createPairing,
  deletePairing,
  movePairing,
  removeRoundFromPairing,
  renamePairing,
} from "../../../actions";

type PairingsManagerProps = {
  tournamentId: number;
  pairings: TournamentPairing[];
  unassigned: TournamentPairingMember[];
};

export function PairingsManager({
  tournamentId,
  pairings,
  unassigned,
}: PairingsManagerProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (action: () => Promise<ActionResult>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
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
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 rounded-xl border border-dashed bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex-1 text-base font-medium">Unassigned</span>
          <span className="text-sm text-muted-foreground">
            {unassigned.length}
          </span>
        </div>
        {unassigned.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Every player in this tournament is in a pairing.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {unassigned.map((player) => (
              <PlayerRow
                key={player.roundId}
                player={player}
                pairingId={null}
                pairings={pairings}
                isPending={isPending}
                onRunAction={run}
              />
            ))}
          </ul>
        )}
      </div>

      {pairings.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No pairings yet. Add one to start grouping the field.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pairings.map((pairing, index) => (
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
                  <span className="text-sm text-muted-foreground">
                    {pairing.members.length}/{PAIRING_MAX_MEMBERS}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    aria-label={`Move ${pairing.name} up`}
                    disabled={isPending || index === 0}
                    onClick={() =>
                      run(() =>
                        movePairing({ pairingId: pairing.id, direction: "up" }),
                      )
                    }
                  >
                    <HugeiconsIcon icon={ArrowUp01Icon} aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    aria-label={`Move ${pairing.name} down`}
                    disabled={isPending || index === pairings.length - 1}
                    onClick={() =>
                      run(() =>
                        movePairing({
                          pairingId: pairing.id,
                          direction: "down",
                        }),
                      )
                    }
                  >
                    <HugeiconsIcon icon={ArrowDown01Icon} aria-hidden />
                  </Button>
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

              {pairing.members.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No players yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {pairing.members.map((player) => (
                    <PlayerRow
                      key={player.roundId}
                      player={player}
                      pairingId={pairing.id}
                      pairings={pairings}
                      isPending={isPending}
                      onRunAction={run}
                    />
                  ))}
                </ul>
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
                      isPending
                        ? "Deleting…"
                        : `Hold to delete ${pairing.name}`
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

// One control covers assigning, moving and removing: membership is keyed by
// Round, so every change is a choice of which Pairing — if any — a player sits
// in. A full Pairing stays selectable so the admin gets the server's message
// rather than a silently dead menu item.
function PlayerRow({
  player,
  pairingId,
  pairings,
  isPending,
  onRunAction,
}: {
  player: TournamentPairingMember;
  pairingId: number | null;
  pairings: TournamentPairing[];
  isPending: boolean;
  onRunAction: (action: () => Promise<ActionResult>) => void;
}) {
  const name = displayName(player);

  return (
    <li className="flex items-center gap-2">
      <span className="flex-1 truncate text-sm">{name}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            aria-label={`Change pairing for ${name}`}
            disabled={isPending || (pairings.length === 0 && pairingId === null)}
          >
            <HugeiconsIcon icon={UserSwitchIcon} aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Move {name} to</DropdownMenuLabel>
          {pairings.map((pairing) => (
            <DropdownMenuItem
              key={pairing.id}
              disabled={pairing.id === pairingId}
              onSelect={() =>
                onRunAction(() =>
                  assignRoundToPairing({
                    pairingId: pairing.id,
                    roundId: player.roundId,
                  }),
                )
              }
            >
              {pairing.name}
              <span className="ml-auto text-xs text-muted-foreground">
                {pairing.members.length}/{PAIRING_MAX_MEMBERS}
              </span>
            </DropdownMenuItem>
          ))}
          {pairingId === null ? null : (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() =>
                  onRunAction(() =>
                    removeRoundFromPairing({ roundId: player.roundId }),
                  )
                }
              >
                Unassigned
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
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
