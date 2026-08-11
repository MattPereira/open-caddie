"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MatchPlayContent } from "@/app/(app)/matches/[id]/_components/match-play-tab-content";
import { SkinsContent } from "@/components/features/scores/skins-content";
import type { MatchScoreboard } from "./round-play";

export function MatchScoreboardDialog({
  scoreboard,
}: {
  scoreboard: MatchScoreboard | null;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" className="flex-1" size="xl">
          Scoreboard
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[calc(100%-1.5rem)] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Scoreboard</DialogTitle>
          <DialogDescription>
            Match play and skins results for this match.
          </DialogDescription>
        </DialogHeader>
        {scoreboard ? (
          <Tabs defaultValue="match" className="w-full">
            <TabsList className="mb-3 h-10! w-full p-1 sm:w-fit">
              <TabsTrigger
                value="match"
                className="flex-1 px-5 py-2 text-base sm:flex-none"
              >
                Match
              </TabsTrigger>
              <TabsTrigger
                value="skins"
                className="flex-1 px-5 py-2 text-base sm:flex-none"
              >
                Skins
              </TabsTrigger>
            </TabsList>
            <TabsContent value="match" className="flex flex-col gap-5">
              <MatchPlayContent
                format={scoreboard.format}
                rounds={scoreboard.rounds}
                teams={scoreboard.teams}
              />
            </TabsContent>
            <TabsContent value="skins" className="flex flex-col gap-5">
              <SkinsContent rounds={scoreboard.rounds} />
            </TabsContent>
          </Tabs>
        ) : (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Scoreboard is not available for this round.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
