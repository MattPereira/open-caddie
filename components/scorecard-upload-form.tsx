"use client";

import Link from "next/link";
import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ImageUpload01Icon, Tick02Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PlayerCard } from "@/components/player-card";

export type ScorecardPlayer = {
  roundId: number;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  image: string | null;
};

type ScorecardUploadFormProps = {
  cancelHref: string;
  players: ScorecardPlayer[];
};

export function ScorecardUploadForm({
  cancelHref,
  players,
}: ScorecardUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [selectedRoundIds, setSelectedRoundIds] = useState<Set<number>>(
    new Set(),
  );
  const previewUrl = file ? URL.createObjectURL(file) : null;
  const canSubmit = file != null && selectedRoundIds.size > 0;

  const toggleRound = (roundId: number) => {
    setSelectedRoundIds((prev) => {
      const next = new Set(prev);
      if (next.has(roundId)) next.delete(roundId);
      else next.add(roundId);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-6">
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
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">Scorecard photo</h2>
          <p className="text-sm text-muted-foreground">
            Take a photo or pick one from your device.
          </p>
        </div>

        {previewUrl ? (
          <div className="flex flex-col gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Scorecard preview"
              className="w-full rounded-md border"
            />
            <label className="cursor-pointer self-start">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <span className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground">
                Replace image
              </span>
            </label>
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <HugeiconsIcon icon={ImageUpload01Icon} size={32} />
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <span className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground">
                  Choose image
                </span>
              </label>
            </CardContent>
          </Card>
        )}
      </section>

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        <Button type="button" disabled={!canSubmit}>
          Upload scorecard
        </Button>
      </div>
    </div>
  );
}
