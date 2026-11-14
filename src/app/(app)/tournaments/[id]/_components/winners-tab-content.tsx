import { displayName, getInitials } from "@/modules/players/player-name";
import { GreenieCard } from "@/components/domain/greenie-card";
import { WinnerCard } from "@/components/domain/winner-card";
import { TabsContent } from "@/components/ui/tabs";
import {
  tournamentSkins,
  greenieWinners,
  rankPutts,
  rankStrokes,
} from "@/lib/tournaments/results";
import type { getTournamentById } from "@/lib/tournaments/queries";

type Tournament = NonNullable<Awaited<ReturnType<typeof getTournamentById>>>;
type TournamentRound = Tournament["rounds"][number];
type WinnerMetric = "strokes" | "putts";

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
    rankStrokes(rounds).slice(0, 3),
    "strokes",
  );
  const puttsWinners = toWinnerRows(rankPutts(rounds).slice(0, 3), "putts");
  const greenieRows = greenieWinners(greenies);
  const skinWinners = toSkinWinnerRows(rounds);
  const hasWinners =
    strokesWinners.length > 0 ||
    puttsWinners.length > 0 ||
    greenieRows.length > 0 ||
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
          {greenieRows.map((greenie) => (
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
      // Blank line keeps the name level with the strokes, which sit above the hole.
      secondary={"\u00a0"}
      primaryLabel={`Hole ${winner.hole}`}
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
        metric === "strokes" ? formatDecimalScore(round.playingHandicap) : net,
      primaryLabel: metric === "strokes" ? "Net" : "Putts",
      primaryValue: metric === "strokes" ? net : putts,
    };
  });
}

function toSkinWinnerRows(rounds: TournamentRound[]): SkinWinnerRow[] {
  return tournamentSkins(rounds).map((skin) => ({
    key: `skin-${skin.round.id}-${skin.hole}`,
    hole: skin.hole,
    playerName: displayName({ ...skin.round, email: null }),
    initials: getInitials({ ...skin.round, email: null }),
    image: skin.round.image,
    primaryLabel: "Score",
    primaryValue: skin.netStrokes.toString(),
    primaryValueAdjusted: skin.strokes !== skin.netStrokes,
  }));
}

function formatWholeScore(score: number | null) {
  return score == null ? "-" : score.toString();
}

function formatDecimalScore(score: number | null) {
  return score == null ? "-" : score.toFixed(1);
}
