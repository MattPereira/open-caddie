import { TableFrame } from "@/components/shared/responsive-table";
import type { RoundScoresTableRound } from "@/components/features/scores/round-scores-table";
import {
  isEligibleSkinsRound,
  toSkinsView,
  type SkinHoleRow,
  type SkinPlayerView,
} from "@/components/features/scores/skins";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WinnerCard } from "@/components/domain/winner-card";
import { cn } from "@/lib/utils";

export function SkinsContent({ rounds }: { rounds: RoundScoresTableRound[] }) {
  const skinsRounds = rounds.filter(isEligibleSkinsRound);

  if (skinsRounds.length < 2) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Skins scoring is available once at least two players have recorded a
            score.
          </p>
        </CardContent>
      </Card>
    );
  }

  const skins = toSkinsView(skinsRounds);

  return (
    <>
      <div className="max-w-3xl flex flex-col gap-5">
        <Accordion type="single" collapsible className="rounded-lg border px-4">
          <AccordionItem value="rules">
            <AccordionTrigger className="text-base">
              How skins game works
            </AccordionTrigger>
            <AccordionContent className="text-base text-muted-foreground">
              The skins game uses relative handicaps. The lowest handicap player
              serves as the baseline and other players receive the diff on the
              hardest handicap holes. Tied holes carry over, and the next unique
              low hole score wins the accumulated skins.
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex flex-col gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            {skins.players.map((player) => (
              <WinnerCard
                key={player.id}
                playerName={player.name}
                initials={player.initials}
                image={player.image}
                secondary={
                  <span className="flex flex-col">
                    <span>
                      Handicap {formatDecimalScore(player.playingHandicap)}
                    </span>
                    <span>Gets {player.receivedStrokes}</span>
                  </span>
                }
                primaryLabel="Skins"
                primaryValue={player.skinsWon.toString()}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <SkinsTable holes={skins.holes} players={skins.players} />
      </div>
    </>
  );
}

function SkinsTable({
  holes,
  players,
}: {
  holes: SkinHoleRow[];
  players: SkinPlayerView[];
}) {
  return (
    <>
      <div className="hidden lg:block">
        <SkinsFullTable holes={holes} players={players} />
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-5 *:w-full sm:w-fit lg:hidden">
        <SkinsNineTable
          label="Out"
          holes={holes.slice(0, 9)}
          players={players}
        />
        <SkinsNineTable label="In" holes={holes.slice(9)} players={players} />
      </div>
    </>
  );
}

function SkinsFullTable({
  holes,
  players,
}: {
  holes: SkinHoleRow[];
  players: SkinPlayerView[];
}) {
  const frontNine = holes.slice(0, 9);
  const backNine = holes.slice(9);

  return (
    <TableFrame className="w-full">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="sticky left-0 z-10 bg-muted/60 px-2">
              Player
            </TableHead>
            {frontNine.map((hole) => (
              <TableHead key={hole.hole} className="px-1 text-center">
                {hole.hole}
              </TableHead>
            ))}
            <TableHead className="w-12 border-x bg-muted/60 px-1 text-center">
              Out
            </TableHead>
            {backNine.map((hole) => (
              <TableHead key={hole.hole} className="px-1 text-center">
                {hole.hole}
              </TableHead>
            ))}
            <TableHead className="w-12 border-x bg-muted/60 px-1 text-center">
              In
            </TableHead>
            <TableHead className="w-12 border-x bg-muted/60 px-1 text-center">
              Tot
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((player) => {
            const frontSkins = frontNine.reduce(
              (sum, hole) =>
                sum +
                (hole.winningRoundId === player.id ? hole.skinsAwarded : 0),
              0,
            );
            const backSkins = backNine.reduce(
              (sum, hole) =>
                sum +
                (hole.winningRoundId === player.id ? hole.skinsAwarded : 0),
              0,
            );
            return (
              <TableRow key={player.id}>
                <TableCell className="sticky left-0 z-10 bg-card font-medium">
                  {player.name.split(" ")[0]}
                </TableCell>
                {frontNine.map((hole) => {
                  const result = hole.players.find(
                    (p) => p.roundId === player.id,
                  );
                  return (
                    <TableCell
                      key={hole.hole}
                      className="px-1 py-2 text-center tabular-nums"
                    >
                      <NetScore
                        score={result?.netScore ?? null}
                        adjusted={(result?.receivedStrokes ?? 0) > 0}
                        wonHole={hole.winningRoundId === player.id}
                        skinsAwarded={hole.skinsAwarded}
                      />
                    </TableCell>
                  );
                })}
                <TableCell className="w-12 border-x bg-muted/20 px-1 py-2 text-center font-medium tabular-nums">
                  {`+${frontSkins}`}
                </TableCell>
                {backNine.map((hole) => {
                  const result = hole.players.find(
                    (p) => p.roundId === player.id,
                  );
                  return (
                    <TableCell
                      key={hole.hole}
                      className="px-1 py-2 text-center tabular-nums"
                    >
                      <NetScore
                        score={result?.netScore ?? null}
                        adjusted={(result?.receivedStrokes ?? 0) > 0}
                        wonHole={hole.winningRoundId === player.id}
                        skinsAwarded={hole.skinsAwarded}
                      />
                    </TableCell>
                  );
                })}
                <TableCell className="w-12 border-x bg-muted/20 px-1 py-2 text-center font-medium tabular-nums">
                  {`+${backSkins}`}
                </TableCell>
                <TableCell className="w-12 border-x bg-muted/20 px-1 py-2 text-center font-medium tabular-nums">
                  {`+${frontSkins + backSkins}`}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableFrame>
  );
}

function SkinsNineTable({
  label,
  holes,
  players,
}: {
  label: string;
  holes: SkinHoleRow[];
  players: SkinPlayerView[];
}) {
  const playerSkins = new Map<number, number>(
    players.map((player) => [
      player.id,
      holes.reduce(
        (sum, hole) =>
          sum + (hole.winningRoundId === player.id ? hole.skinsAwarded : 0),
        0,
      ),
    ]),
  );
  return (
    <div className="flex flex-col gap-3">
      <TableFrame className="w-full sm:w-fit">
        <Table className="w-full sm:w-max">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-12 border-r bg-muted/60 px-2 text-center">
                Hole
              </TableHead>
              {players.map((player) => (
                <TableHead key={player.id} className="w-16 px-2 text-center">
                  {player.initials}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {holes.map((hole) => (
              <TableRow key={hole.hole}>
                <TableCell className="border-r bg-muted/40 px-2 text-center text-base font-medium tabular-nums">
                  {hole.hole}
                </TableCell>
                {players.map((player) => {
                  const result = hole.players.find(
                    (playerResult) => playerResult.roundId === player.id,
                  );

                  return (
                    <TableCell
                      key={player.id}
                      className="px-2 text-center text-base tabular-nums"
                    >
                      <NetScore
                        score={result?.netScore ?? null}
                        adjusted={(result?.receivedStrokes ?? 0) > 0}
                        wonHole={hole.winningRoundId === player.id}
                        skinsAwarded={hole.skinsAwarded}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="border-r bg-muted/60 px-2 text-center text-base font-medium text-muted-foreground">
                {label}
              </TableCell>
              {players.map((player) => (
                <TableCell
                  key={player.id}
                  className="px-2 text-center text-base font-medium tabular-nums"
                >
                  {`+${playerSkins.get(player.id) ?? 0}`}
                </TableCell>
              ))}
            </TableRow>
          </TableFooter>
        </Table>
      </TableFrame>
    </div>
  );
}

function NetScore({
  score,
  adjusted,
  wonHole,
  skinsAwarded,
}: {
  score: number | null;
  adjusted: boolean;
  wonHole: boolean;
  skinsAwarded: number;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-full border border-transparent tabular-nums text-foreground outline outline-0 outline-offset-2 outline-transparent",
        wonHole && "border-foreground",
        wonHole && skinsAwarded > 1 && "outline-1 outline-foreground",
        wonHole &&
          skinsAwarded > 2 &&
          "relative after:absolute after:inset-[-6px] after:rounded-full after:border after:border-foreground after:content-['']",
        adjusted && "text-red-600 dark:text-red-500",
      )}
    >
      {formatScore(score)}
    </span>
  );
}

function formatScore(score: number | null) {
  return score == null ? "-" : score;
}

function formatDecimalScore(score: number | null) {
  return score == null ? "-" : score.toFixed(1);
}
