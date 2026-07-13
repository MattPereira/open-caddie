import { displayName, getInitials } from "@/lib/players/player-name";
import { GreenieCard } from "@/components/domain/greenie-card";
import { WinnerCard } from "@/components/domain/winner-card";
import { TabsContent } from "@/components/ui/tabs";
import type { getTournamentById } from "@/db/queries/tournaments";

type Tournament = NonNullable<Awaited<ReturnType<typeof getTournamentById>>>;
type TournamentRound = Tournament["rounds"][number];
type TournamentGreenie = Tournament["greenies"][number];
type WinnerMetric = "strokes" | "putts";
type TournamentRoundScore = TournamentRound["scores"][number];

type WinnerRow = {
  key: string;
  playerName: string;
  initials: string;
  image: string | null;
  secondaryLabel?: string;
  secondaryValue?: string;
  primaryLabel: string;
  primaryValue: string;
  primaryValueAdjusted?: boolean;
};

type SkinWinnerRow = WinnerRow & {
  hole: number;
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
  const greenieWinners = getGreenieWinners(greenies);
  const skinWinners = toSkinWinnerRows(rounds);
  const hasWinners =
    strokesWinners.length > 0 ||
    puttsWinners.length > 0 ||
    greenieWinners.length > 0 ||
    skinWinners.length > 0;

  if (!hasWinners) {
    return (
      <TabsContent value="winners">
        <p className="text-sm text-muted-foreground">
          No complete rounds are eligible for winners yet.
        </p>
      </TabsContent>
    );
  }

  return (
    <TabsContent value="winners">
      <div className="flex flex-col gap-6 max-w-6xl">
        <WinnersSection
          title="Strokes"
          description="Lowest net strokes"
          empty="No eligible rounds in this category yet."
          gridClassName="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
        >
          {strokesWinners.map((winner) => (
            <SimpleWinnerCard key={winner.key} winner={winner} />
          ))}
        </WinnersSection>

        <WinnersSection
          title="Putts"
          description="Fewest total putts"
          empty="No eligible rounds in this category yet."
          gridClassName="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
        >
          {puttsWinners.map((winner) => (
            <SimpleWinnerCard key={winner.key} winner={winner} />
          ))}
        </WinnersSection>

        <WinnersSection
          title="Greenies"
          description="Closest to the pin on each par 3"
          empty="No greenies recorded yet."
          gridClassName="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
        >
          {greenieWinners.map((greenie) => (
            <GreenieCard
              key={`greenie-${greenie.roundId}-${greenie.hole}`}
              greenie={greenie}
            />
          ))}
        </WinnersSection>

        <WinnersSection
          title="Skins"
          description="Unique lowest hole score with handicaps"
          empty="No skins won yet."
          gridClassName="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
        >
          {skinWinners.map((winner) => (
            <SkinWinnerCard key={winner.key} winner={winner} />
          ))}
        </WinnersSection>
      </div>
    </TabsContent>
  );
}

function WinnersSection({
  title,
  description,
  empty,
  gridClassName = "flex flex-col gap-3",
  children,
}: {
  title: string;
  description: string;
  empty: string;
  gridClassName?: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children)
    ? children.length > 0
    : Boolean(children);

  return (
    <div className="flex flex-col gap-3">
      <SectionHeading title={title} description={description} />
      {hasChildren ? (
        <div className={gridClassName}>{children}</div>
      ) : (
        <p className="rounded-lg bg-muted px-3 py-6 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      )}
    </div>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h3 className="text-lg font-medium">{title}</h3>
      <div className="text-sm text-muted-foreground">{description}</div>
    </div>
  );
}

function SimpleWinnerCard({ winner }: { winner: WinnerRow }) {
  return (
    <WinnerCard
      playerName={winner.playerName}
      initials={winner.initials}
      image={winner.image}
      secondary={
        winner.secondaryLabel != null && winner.secondaryValue != null
          ? `${winner.secondaryLabel} ${winner.secondaryValue}`
          : undefined
      }
      primaryLabel={winner.primaryLabel}
      primaryValue={winner.primaryValue}
      primaryValueAdjusted={winner.primaryValueAdjusted}
    />
  );
}

function SkinWinnerCard({ winner }: { winner: SkinWinnerRow }) {
  return (
    <WinnerCard
      playerName={winner.playerName}
      initials={winner.initials}
      image={winner.image}
      secondary={`Hole ${winner.hole}`}
      primaryLabel="Strokes"
      primaryValue={winner.primaryValue}
      primaryValueAdjusted={winner.primaryValueAdjusted}
    />
  );
}

function toWinnerRows(
  rounds: TournamentRound[],
  metric: WinnerMetric,
): WinnerRow[] {
  return rounds.map((round) => {
    const playerName = displayName({ ...round, email: null });
    const net = formatDecimalScore(round.netStrokes);
    const putts = formatWholeScore(round.totalPutts);

    return {
      key: `${metric}-${round.id}`,
      playerName,
      initials: getInitials({ ...round, email: null }),
      image: round.image,
      secondaryLabel: metric === "strokes" ? "Hcp" : "Net",
      secondaryValue:
        metric === "strokes"
          ? formatDecimalScore(round.playingHandicap)
          : net,
      primaryLabel: metric === "strokes" ? "Net" : "Putts",
      primaryValue: metric === "strokes" ? net : putts,
    };
  });
}

function getGreenieWinners(greenies: TournamentGreenie[]) {
  const winnersByHole = new Map<number, TournamentGreenie>();

  for (const greenie of [...greenies].sort(compareGreenies)) {
    if (!winnersByHole.has(greenie.hole)) {
      winnersByHole.set(greenie.hole, greenie);
    }
  }

  return Array.from(winnersByHole.values());
}

function toSkinWinnerRows(rounds: TournamentRound[]): SkinWinnerRow[] {
  const completeRounds = rounds.filter(isEligibleSkinsRound);
  const winners: SkinWinnerRow[] = [];

  for (let hole = 1; hole <= 18; hole++) {
    const scores = completeRounds.flatMap((round) => {
      const score = round.scores.find((roundScore) => roundScore.hole === hole);

      if (!isEligibleSkinsScore(score)) {
        return [];
      }

      const adjustedStrokes = getAdjustedSkinsStrokes({
        strokes: score.strokes,
        holeHandicap: score.handicap,
        playingHandicap: round.playingHandicap,
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
      hole,
      playerName,
      initials: getInitials({ ...winner.round, email: null }),
      image: winner.round.image,
      primaryLabel: "Score",
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
  playingHandicap,
}: {
  strokes: number;
  holeHandicap: number;
  playingHandicap: number;
}) {
  const strokedHoleCount = Math.min(
    18,
    Math.max(0, Math.floor(playingHandicap / 2)),
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

  const netCompare = compareNullableNumbers(a.netStrokes, b.netStrokes);
  if (netCompare !== 0) return netCompare;

  const handicapCompare = b.playingHandicap - a.playingHandicap;
  if (handicapCompare !== 0) return handicapCompare;

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
