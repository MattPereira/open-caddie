"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type ClientRect,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import {
  Delete02Icon,
  DragDropVerticalIcon,
  PencilEdit02Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HoldToConfirmButton } from "@/components/shared/hold-to-confirm-button";
import { PlayerCard } from "@/components/domain/player-card";
import { displayName } from "@/lib/players/player-name";
import { PAIRING_MAX_MEMBERS } from "@/lib/tournaments/pairings";
import type {
  TournamentPairing,
  TournamentPairingMember,
} from "@/lib/tournaments/queries";
import type { ActionResult } from "../../../actions";
import { AddPlayersSheet, type AddablePlayer } from "./add-players-sheet";
import {
  assignRoundToPairing,
  createPairing,
  deletePairing,
  removeRoundFromPairing,
  renamePairing,
} from "../../../actions";

const UNASSIGNED_KEY = "unassigned";

// A bucket is one drop target: the unassigned pool, or a Pairing. Keying the
// pool by a string rather than a null Pairing id lets both kinds share one drop
// handler, and `pairingId` is what tells them apart when the drop is written.
type Bucket = {
  key: string;
  pairingId: number | null;
  name: string;
  members: TournamentPairingMember[];
};

type PairingBoardProps = {
  tournamentId: number;
  addablePlayers: AddablePlayer[];
  pairings: TournamentPairing[];
  unassigned: TournamentPairingMember[];
};

// The buckets are the roster: the Tournament's Rounds are what a player is
// here, adding a player creates one, and a new Round lands in the pool. So
// grouping is read and written in the same place the field is.
export function PairingBoard({
  tournamentId,
  addablePlayers,
  pairings,
  unassigned,
}: PairingBoardProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draggingRoundId, setDraggingRoundId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  // The server is the truth; `buckets` only holds the optimistic result of a
  // drop so the card does not snap back while the action and refresh are in
  // flight. New props are a completed refresh, so they always win.
  const [serverProps, setServerProps] = useState({ pairings, unassigned });
  const [buckets, setBuckets] = useState(() => toBuckets(pairings, unassigned));
  if (
    serverProps.pairings !== pairings ||
    serverProps.unassigned !== unassigned
  ) {
    setServerProps({ pairings, unassigned });
    setBuckets(toBuckets(pairings, unassigned));
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    // A press-and-hold starts a drag on touch, so a plain swipe over the list
    // still scrolls the page.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: bucketCoordinateGetter }),
  );

  const run = (action: () => Promise<ActionResult>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        setBuckets(toBuckets(pairings, unassigned));
        return;
      }
      setEditingId(null);
      setDeletingId(null);
      router.refresh();
    });
  };

  const hasAnyPlayers = buckets.some((bucket) => bucket.members.length > 0);

  const draggingPlayer = draggingRoundId
    ? buckets
        .flatMap((bucket) => bucket.members)
        .find((member) => member.roundId === draggingRoundId)
    : null;

  function handleDragStart(event: DragStartEvent) {
    setDraggingRoundId(readRoundId(event.active.data.current));
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingRoundId(null);

    const roundId = readRoundId(event.active.data.current);
    const fromKey = event.active.data.current?.bucketKey as string | undefined;
    const toKey = event.over ? String(event.over.id) : null;
    if (roundId == null || toKey == null || toKey === fromKey) return;

    const target = buckets.find((bucket) => bucket.key === toKey);
    if (!target) return;

    // The server counts the cap under a lock, so this check is only here to
    // spare the admin a round trip that ends in the same message.
    if (
      target.pairingId != null &&
      target.members.length >= PAIRING_MAX_MEMBERS
    ) {
      setError(`A Pairing holds at most ${PAIRING_MAX_MEMBERS} players.`);
      return;
    }

    setBuckets((current) => moveMember(current, roundId, toKey));
    run(() =>
      target.pairingId == null
        ? removeRoundFromPairing({ roundId })
        : assignRoundToPairing({ pairingId: target.pairingId, roundId }),
    );
  }

  return (
    <DndContext
      // dnd-kit derives each draggable's aria-describedby from a module-level
      // counter unless it is given an id, and the server's counter is wherever
      // previous renders left it while a fresh client starts at zero — so the
      // generated ids disagree and hydration fails. One board per page, so a
      // fixed id is enough to make both sides land on the same value.
      id="pairing-board"
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToWindowEdges]}
      accessibility={{ announcements: buildAnnouncements(buckets) }}
      onDragStart={handleDragStart}
      onDragCancel={() => setDraggingRoundId(null)}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="secondary"
            size="xl"
            disabled={isPending}
            onClick={() => run(() => createPairing({ tournamentId }))}
          >
            <HugeiconsIcon icon={PlusSignIcon} data-icon="inline-start" />
            Add pairing
          </Button>
          <AddPlayersSheet
            tournamentId={tournamentId}
            players={addablePlayers}
          />
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        {buckets.map((bucket) => (
          <BucketPanel
            key={bucket.key}
            bucket={bucket}
            isPending={isPending}
            isEditing={
              bucket.pairingId != null && editingId === bucket.pairingId
            }
            isDeleting={
              bucket.pairingId != null && deletingId === bucket.pairingId
            }
            onEditAction={() => {
              setDeletingId(null);
              setEditingId(bucket.pairingId);
            }}
            onDeleteAction={() => {
              setEditingId(null);
              setDeletingId(bucket.pairingId);
            }}
            onCancelAction={() => {
              setEditingId(null);
              setDeletingId(null);
            }}
            onRunAction={run}
            hasAnyPlayers={hasAnyPlayers}
          />
        ))}
      </div>

      <DragOverlay>
        {draggingPlayer ? (
          <div className="opacity-95 shadow-lg">
            <PlayerCard player={draggingPlayer} size="sm" />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function BucketPanel({
  bucket,
  isPending,
  isEditing,
  isDeleting,
  onEditAction,
  onDeleteAction,
  onCancelAction,
  onRunAction,
  hasAnyPlayers,
}: {
  bucket: Bucket;
  isPending: boolean;
  isEditing: boolean;
  isDeleting: boolean;
  onEditAction: () => void;
  onDeleteAction: () => void;
  onCancelAction: () => void;
  onRunAction: (action: () => Promise<ActionResult>) => void;
  hasAnyPlayers: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: bucket.key });
  const isPool = bucket.pairingId == null;
  const isFull = !isPool && bucket.members.length >= PAIRING_MAX_MEMBERS;

  return (
    <section
      ref={setNodeRef}
      aria-label={bucket.name}
      data-over={isOver || undefined}
      className={[
        "flex flex-col gap-3 rounded-xl border px-4 py-3 transition-colors",
        isPool ? "border-dashed bg-muted/40" : "",
        isOver ? "border-primary bg-primary/5" : "",
      ].join(" ")}
    >
      {isEditing && bucket.pairingId != null ? (
        <RenameForm
          name={bucket.name}
          isPending={isPending}
          onCancelAction={onCancelAction}
          onSubmitAction={(name) =>
            onRunAction(() =>
              renamePairing({ pairingId: bucket.pairingId!, name }),
            )
          }
        />
      ) : (
        <div className="flex items-center gap-2">
          <span className="flex-1 text-base font-medium">{bucket.name}</span>
          <span className="text-sm text-muted-foreground">
            {isPool
              ? bucket.members.length
              : `${bucket.members.length}/${PAIRING_MAX_MEMBERS}`}
          </span>
          {isPool ? null : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                aria-label={`Rename ${bucket.name}`}
                disabled={isPending}
                onClick={onEditAction}
              >
                <HugeiconsIcon icon={PencilEdit02Icon} aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Delete ${bucket.name}`}
                disabled={isPending}
                onClick={onDeleteAction}
              >
                <HugeiconsIcon icon={Delete02Icon} aria-hidden />
              </Button>
            </>
          )}
        </div>
      )}

      {bucket.members.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          {!isPool
            ? "Drag players here."
            : hasAnyPlayers
              ? "Every player in this tournament is in a pairing."
              : "No players have been added to this tournament."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {bucket.members.map((player) => (
            <DraggablePlayer
              key={player.roundId}
              player={player}
              bucketKey={bucket.key}
              disabled={isPending}
            />
          ))}
        </ul>
      )}

      {isFull ? (
        <p className="text-sm text-muted-foreground">
          This pairing is full. Move a player out to make room.
        </p>
      ) : null}

      {isDeleting && bucket.pairingId != null ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="xl"
            disabled={isPending}
            onClick={onCancelAction}
          >
            Cancel
          </Button>
          <HoldToConfirmButton
            disabled={isPending}
            idleLabel={
              isPending ? "Deleting…" : `Hold to delete ${bucket.name}`
            }
            onConfirmAction={() =>
              onRunAction(() =>
                deletePairing({ pairingId: bucket.pairingId! }),
              )
            }
          />
        </div>
      ) : null}
    </section>
  );
}

// The whole row is the activator. `touch-action: manipulation` rather than
// `none` keeps a swipe over the list scrolling the page: a swipe moves past the
// touch sensor's tolerance before its delay elapses, so only a press-and-hold
// becomes a drag. The grip is decoration — it says the row is draggable without
// being the only place that works.
function DraggablePlayer({
  player,
  bucketKey,
  disabled,
}: {
  player: TournamentPairingMember;
  bucketKey: string;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `round-${player.roundId}`,
    disabled,
    data: { roundId: player.roundId, bucketKey },
  });

  return (
    <li
      ref={setNodeRef}
      className={`relative touch-manipulation rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none ${
        disabled ? "" : "cursor-grab active:cursor-grabbing"
      } ${isDragging ? "opacity-40" : ""}`}
      {...attributes}
      {...listeners}
    >
      <PlayerCard player={player} size="sm" />
      <HugeiconsIcon
        icon={DragDropVerticalIcon}
        aria-hidden
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
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

function toBuckets(
  pairings: TournamentPairing[],
  unassigned: TournamentPairingMember[],
): Bucket[] {
  return [
    {
      key: UNASSIGNED_KEY,
      pairingId: null,
      name: "Unassigned",
      members: unassigned,
    },
    ...pairings.map((pairing) => ({
      key: `pairing-${pairing.id}`,
      pairingId: pairing.id,
      name: pairing.name,
      members: pairing.members,
    })),
  ];
}

// Members are kept in the server's order — by name — so the optimistic bucket
// and the one that arrives with the refresh agree on where the card sits.
function moveMember(
  buckets: Bucket[],
  roundId: number,
  toKey: string,
): Bucket[] {
  const player = buckets
    .flatMap((bucket) => bucket.members)
    .find((member) => member.roundId === roundId);
  if (!player) return buckets;

  return buckets.map((bucket) => {
    if (bucket.key === toKey) {
      return {
        ...bucket,
        members: [...bucket.members, player].sort((a, b) =>
          displayName(a).localeCompare(displayName(b)),
        ),
      };
    }
    if (bucket.members.some((member) => member.roundId === roundId)) {
      return {
        ...bucket,
        members: bucket.members.filter((member) => member.roundId !== roundId),
      };
    }
    return bucket;
  });
}

function readRoundId(data: Record<string, unknown> | undefined) {
  const roundId = data?.roundId;
  return typeof roundId === "number" ? roundId : null;
}

// Arrow keys step between whole buckets rather than by a fixed pixel amount:
// the buckets are stacked, and nothing between them is a drop target, so a
// pixel-wise walk would spend most of its keystrokes in dead space.
const bucketCoordinateGetter: KeyboardCoordinateGetter = (
  event,
  { context: { collisionRect, droppableContainers, droppableRects } },
) => {
  const step =
    event.code === "ArrowDown" ? 1 : event.code === "ArrowUp" ? -1 : 0;
  if (step === 0 || !collisionRect) return;
  event.preventDefault();

  const targets = droppableContainers
    .getEnabled()
    .map((container) => ({
      id: container.id,
      rect: droppableRects.get(container.id),
    }))
    .filter(
      (target): target is { id: UniqueIdentifier; rect: ClientRect } =>
        target.rect != null,
    )
    .sort((a, b) => a.rect.top - b.rect.top);
  if (targets.length === 0) return;

  const current = targets.reduce((closest, target) =>
    Math.abs(target.rect.top - collisionRect.top) <
    Math.abs(closest.rect.top - collisionRect.top)
      ? target
      : closest,
  );
  const next = targets[targets.indexOf(current) + step];
  if (!next) return;

  return { x: next.rect.left + 8, y: next.rect.top + 8 };
};

function buildAnnouncements(buckets: Bucket[]): Announcements {
  const nameOf = (id: UniqueIdentifier) =>
    buckets.find((bucket) => bucket.key === String(id))?.name ?? "the list";
  const playerOf = (id: UniqueIdentifier) => {
    const roundId = Number(String(id).replace("round-", ""));
    const player = buckets
      .flatMap((bucket) => bucket.members)
      .find((member) => member.roundId === roundId);
    return player ? displayName(player) : "Player";
  };

  return {
    onDragStart: ({ active }) => `Picked up ${playerOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${playerOf(active.id)} is over ${nameOf(over.id)}.`
        : `${playerOf(active.id)} is not over a pairing.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${playerOf(active.id)} was moved to ${nameOf(over.id)}.`
        : `${playerOf(active.id)} was dropped.`,
    onDragCancel: ({ active }) =>
      `Moving ${playerOf(active.id)} was cancelled.`,
  };
}
