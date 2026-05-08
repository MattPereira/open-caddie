import Link from "next/link";

import { displayName, getInitials } from "@/components/player-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { TabsContent } from "@/components/ui/tabs";
import type { getTournamentById } from "@/db/queries/tournaments";
import { cn } from "@/lib/utils";

type Tournament = NonNullable<Awaited<ReturnType<typeof getTournamentById>>>;
type TournamentRound = Tournament["rounds"][number];
type WinnerMetric = "strokes" | "putts";

type WinnerRow = {
  round: TournamentRound;
  playerName: string;
  initials: string;
  primaryValue: string;
};

export function WinnersTabContent({
  rounds,
}: {
  rounds: Tournament["rounds"];
}) {
  const strokesWinners = toWinnerRows(
    rounds
      .filter(isEligibleStrokesRound)
      .sort(compareStrokesWinners)
      .slice(0, 3),
    "strokes",
  );
  const puttsWinners = toWinnerRows(
    rounds.filter(isEligiblePuttsRound).sort(comparePuttsWinners).slice(0, 3),
    "putts",
  );
  const hasWinners = strokesWinners.length > 0 || puttsWinners.length > 0;

  return (
    <TabsContent value="winners">
      {hasWinners ? (
        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
          <WinnerCategoryCard
            title="Strokes"
            description="Lowest net strokes"
            winners={strokesWinners}
            metric="strokes"
          />
          <WinnerCategoryCard
            title="Putts"
            description="Fewest total putts"
            winners={puttsWinners}
            metric="putts"
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No complete rounds are eligible for winners yet.
        </p>
      )}
    </TabsContent>
  );
}

function WinnerCategoryCard({
  title,
  description,
  winners,
  metric,
}: {
  title: string;
  description: string;
  winners: WinnerRow[];
  metric: WinnerMetric;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="min-w-0">
          <CardTitle className="truncate">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {winners.length > 0 ? (
          <ItemGroup className="gap-3">
            {winners.map((winner, index) => (
              <WinnerItem
                key={`${metric}-${winner.round.id}`}
                winner={winner}
                rank={index + 1}
              />
            ))}
          </ItemGroup>
        ) : (
          <p className="rounded-lg bg-muted px-3 py-6 text-center text-sm text-muted-foreground">
            No eligible rounds in this category yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function WinnerItem({ winner, rank }: { winner: WinnerRow; rank: number }) {
  return (
    <Item asChild variant="outline" className="items-center gap-3 p-2">
      <Link href={`/rounds/${winner.round.id}`}>
        <span
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-lg border text-base font-semibold tabular-nums",
          )}
        >
          {rank}
        </span>
        <ItemMedia className="self-center translate-y-0">
          <Avatar className={cn("size-12")}>
            {winner.round.image ? (
              <AvatarImage src={winner.round.image} alt={winner.playerName} />
            ) : null}
            <AvatarFallback>{winner.initials}</AvatarFallback>
          </Avatar>
        </ItemMedia>
        <ItemContent className="min-w-0 gap-0!">
          <ItemTitle className="text-base">{winner.playerName}</ItemTitle>
          <ItemDescription></ItemDescription>
        </ItemContent>
        <ItemActions className="ml-auto flex-col items-end gap-1">
          <span className="text-right text-base tabular-nums">
            {winner.primaryValue}
          </span>
        </ItemActions>
      </Link>
    </Item>
  );
}

function toWinnerRows(rounds: TournamentRound[], metric: WinnerMetric) {
  return rounds.map((round) => {
    const playerName = displayName({ ...round, email: null });
    const net = formatDecimalScore(round.netStrokes);
    const putts = formatWholeScore(round.totalPutts);

    return {
      round,
      playerName,
      initials: getInitials({ ...round, email: null }),
      primaryValue: metric === "strokes" ? net : putts,
    };
  });
}

function isEligibleStrokesRound(round: TournamentRound) {
  return round.isComplete && round.netStrokes != null;
}

function isEligiblePuttsRound(round: TournamentRound) {
  return round.isComplete && round.recordedPuttsCount >= 18;
}

function compareStrokesWinners(a: TournamentRound, b: TournamentRound) {
  const netCompare = compareNullableNumbers(a.netStrokes, b.netStrokes);
  if (netCompare !== 0) return netCompare;

  const grossCompare = a.totalStrokes - b.totalStrokes;
  if (grossCompare !== 0) return grossCompare;

  return comparePlayers(a, b);
}

function comparePuttsWinners(a: TournamentRound, b: TournamentRound) {
  const puttsCompare = a.totalPutts - b.totalPutts;
  if (puttsCompare !== 0) return puttsCompare;

  const grossCompare = a.totalStrokes - b.totalStrokes;
  if (grossCompare !== 0) return grossCompare;

  const netCompare = compareNullableNumbers(a.netStrokes, b.netStrokes);
  if (netCompare !== 0) return netCompare;

  return comparePlayers(a, b);
}

function compareNullableNumbers(a: number | null, b: number | null) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

function comparePlayers(a: TournamentRound, b: TournamentRound) {
  return displayName({ ...a, email: null }).localeCompare(
    displayName({ ...b, email: null }),
  );
}

function formatWholeScore(score: number | null) {
  return score == null ? "-" : score.toString();
}

function formatDecimalScore(score: number | null) {
  return score == null ? "-" : score.toFixed(1);
}
