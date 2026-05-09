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
type TournamentGreenie = Tournament["greenies"][number];
type WinnerMetric = "strokes" | "putts";
type TournamentRoundScore = TournamentRound["scores"][number];

type WinnerRow = {
  key: string;
  leftValue: string | number;
  playerName: string;
  initials: string;
  image: string | null;
  primaryValue: string;
  primaryValueAdjusted?: boolean;
};

export function WinnersTabContent({
  rounds,
  greenies,
}: {
  rounds: Tournament["rounds"];
  greenies: Tournament["greenies"];
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
  const greenieWinners = toGreenieWinnerRows(greenies);
  const skinWinners = toSkinWinnerRows(rounds);
  const hasWinners =
    strokesWinners.length > 0 ||
    puttsWinners.length > 0 ||
    greenieWinners.length > 0 ||
    skinWinners.length > 0;

  return (
    <TabsContent value="winners">
      {hasWinners ? (
        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
          <WinnerCategoryCard
            title="Strokes"
            description="Lowest net strokes"
            winners={strokesWinners}
          />
          <WinnerCategoryCard
            title="Putts"
            description="Fewest total putts"
            winners={puttsWinners}
          />
          <WinnerCategoryCard
            title="Greenies"
            description="Closest to the pin"
            winners={greenieWinners}
          />
          <WinnerCategoryCard
            title="Skins"
            description="Unique low adjusted score"
            winners={skinWinners}
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
}: {
  title: string;
  description: string;
  winners: WinnerRow[];
}) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="min-w-0 flex justify-between">
          <CardTitle className="truncate">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {winners.length > 0 ? (
          <ItemGroup className="gap-3">
            {winners.map((winner) => (
              <WinnerItem key={winner.key} winner={winner} />
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

function WinnerItem({ winner }: { winner: WinnerRow }) {
  return (
    <Item variant="outline" className="items-center gap-3 p-2">
      <span
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-lg border text-base font-semibold tabular-nums",
        )}
      >
        {winner.leftValue}
      </span>
      <ItemMedia className="self-center translate-y-0">
        <Avatar className={cn("size-12")}>
          {winner.image ? (
            <AvatarImage src={winner.image} alt={winner.playerName} />
          ) : null}
          <AvatarFallback>{winner.initials}</AvatarFallback>
        </Avatar>
      </ItemMedia>
      <ItemContent className="min-w-0 gap-0!">
        <ItemTitle className="text-base">{winner.playerName}</ItemTitle>
        <ItemDescription></ItemDescription>
      </ItemContent>
      <ItemActions className="ml-auto flex-col items-end gap-1">
        <span
          className={cn(
            "text-right text-base tabular-nums",
            winner.primaryValueAdjusted === true &&
              "text-red-600 dark:text-red-500",
            winner.primaryValueAdjusted === false &&
              "text-black dark:text-foreground",
          )}
        >
          {winner.primaryValue}
        </span>
      </ItemActions>
    </Item>
  );
}

function toWinnerRows(rounds: TournamentRound[], metric: WinnerMetric) {
  return rounds.map((round, index) => {
    const playerName = displayName({ ...round, email: null });
    const net = formatDecimalScore(round.netStrokes);
    const putts = formatWholeScore(round.totalPutts);

    return {
      key: `${metric}-${round.id}`,
      leftValue: index + 1,
      playerName,
      initials: getInitials({ ...round, email: null }),
      image: round.image,
      primaryValue: metric === "strokes" ? net : putts,
    };
  });
}

function toGreenieWinnerRows(greenies: TournamentGreenie[]) {
  const winnersByHole = new Map<number, TournamentGreenie>();

  for (const greenie of [...greenies].sort(compareGreenies)) {
    if (!winnersByHole.has(greenie.hole)) {
      winnersByHole.set(greenie.hole, greenie);
    }
  }

  return Array.from(winnersByHole.values()).map((greenie) => ({
    key: `greenie-${greenie.roundId}-${greenie.hole}`,
    leftValue: greenie.hole,
    playerName: displayName({ ...greenie, email: null }),
    initials: getInitials({ ...greenie, email: null }),
    image: greenie.image,
    primaryValue: formatGreenieDistance(greenie),
  }));
}

function toSkinWinnerRows(rounds: TournamentRound[]) {
  const completeRounds = rounds.filter(isEligibleSkinsRound);
  const winners: WinnerRow[] = [];

  for (let hole = 1; hole <= 18; hole++) {
    const scores = completeRounds.flatMap((round) => {
      const score = round.scores.find((roundScore) => roundScore.hole === hole);

      if (!isEligibleSkinsScore(score)) {
        return [];
      }

      const adjustedStrokes = getAdjustedSkinsStrokes({
        strokes: score.strokes,
        holeHandicap: score.handicap,
        tournamentHandicap: round.tournamentHandicap,
      });

      return [
        {
          round,
          rawStrokes: score.strokes,
          adjustedStrokes,
        },
      ];
    });

    if (scores.length !== completeRounds.length) {
      continue;
    }

    const lowestScore = Math.min(
      ...scores.map((score) => score.adjustedStrokes),
    );
    const lowScores = scores.filter(
      (score) => score.adjustedStrokes === lowestScore,
    );

    if (lowScores.length !== 1) {
      continue;
    }

    const [winner] = lowScores;
    const playerName = displayName({ ...winner.round, email: null });

    winners.push({
      key: `skin-${winner.round.id}-${hole}`,
      leftValue: hole,
      playerName,
      initials: getInitials({ ...winner.round, email: null }),
      image: winner.round.image,
      primaryValue: winner.adjustedStrokes.toString(),
      primaryValueAdjusted: winner.rawStrokes !== winner.adjustedStrokes,
    });
  }

  return winners;
}

function isEligibleStrokesRound(round: TournamentRound) {
  return round.isComplete && round.netStrokes != null;
}

function isEligiblePuttsRound(round: TournamentRound) {
  return round.isComplete && round.recordedPuttsCount >= 18;
}

function isEligibleSkinsRound(round: TournamentRound) {
  return round.isComplete;
}

function isEligibleSkinsScore(
  score: TournamentRoundScore | undefined,
): score is TournamentRoundScore & {
  handicap: number;
  strokes: number;
} {
  return score?.strokes != null && score.handicap != null;
}

function getAdjustedSkinsStrokes({
  strokes,
  holeHandicap,
  tournamentHandicap,
}: {
  strokes: number;
  holeHandicap: number;
  tournamentHandicap: number;
}) {
  const strokedHoleCount = Math.min(
    18,
    Math.max(0, Math.floor(tournamentHandicap / 2)),
  );

  return holeHandicap <= strokedHoleCount ? strokes - 1 : strokes;
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

function compareGreenies(a: TournamentGreenie, b: TournamentGreenie) {
  const holeCompare = a.hole - b.hole;
  if (holeCompare !== 0) return holeCompare;

  const feetCompare = a.feet - b.feet;
  if (feetCompare !== 0) return feetCompare;

  const inchesCompare = a.inches - b.inches;
  if (inchesCompare !== 0) return inchesCompare;

  return displayName({ ...a, email: null }).localeCompare(
    displayName({ ...b, email: null }),
  );
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

function formatGreenieDistance(
  greenie: Pick<TournamentGreenie, "feet" | "inches">,
) {
  if (greenie.inches === 0) {
    return `${greenie.feet}'`;
  }

  return `${greenie.feet}' ${greenie.inches}"`;
}
