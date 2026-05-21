import { displayName, getInitials } from "@/components/player-card";
import { TableFrame } from "@/components/responsive-table";
import type { RoundScoresTableRound } from "@/components/round-scores-table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WinnerCard } from "@/components/winner-card";
import { evaluateMatchPlay } from "@/lib/match-play";
import { cn } from "@/lib/utils";

type SkinsRound = RoundScoresTableRound & {
  holes: {
    hole: number;
    par: number;
    handicap: number | null;
  }[];
};

type SkinHoleRow = {
  hole: number;
  holeHandicap: number | null;
  winningRoundId: number | null;
  players: {
    roundId: number;
    netScore: number | null;
    receivedStrokes: number;
  }[];
};

type SkinPlayerView = {
  id: number;
  name: string;
  firstName: string;
  initials: string;
  image: string | null;
  playingHandicap: number | null;
  receivedStrokes: number;
  skinsWon: number;
};

export function SkinsTabContent({
  rounds,
}: {
  rounds: RoundScoresTableRound[];
}) {
  const skinsRounds = rounds.filter(isEligibleSkinsRound);

  if (skinsRounds.length < 2) {
    return (
      <TabsContent value="skins">
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Skins scoring is available once at least two complete player
              rounds have been recorded.
            </p>
          </CardContent>
        </Card>
      </TabsContent>
    );
  }

  const skins = toSkinsView(skinsRounds);

  return (
    <TabsContent value="skins" className="flex flex-col gap-5">
      <Alert variant="info">
        <AlertDescription className="text-base">
          Skins game uses relative handicaps. The lowest-handicap player is the
          baseline and other players receive the difference on the hardest
          handicap holes. A skin is only awarded for a unique low hole score.
        </AlertDescription>
      </Alert>

      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-medium">Summary</h3>
        <div className="grid max-w-2xl gap-3 md:grid-cols-2">
          {skins.players.map((player) => (
            <WinnerCard
              key={player.id}
              playerName={player.name}
              initials={player.initials}
              image={player.image}
              secondary={`Hcp ${formatDecimalScore(player.playingHandicap)} · Gets ${player.receivedStrokes}`}
              primaryLabel="Skins"
              primaryValue={player.skinsWon.toString()}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <SkinsTable holes={skins.holes} players={skins.players} />
      </div>
    </TabsContent>
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
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-5 *:w-full sm:w-fit">
      <SkinsNineTable
        title="Front"
        holes={holes.slice(0, 9)}
        players={players}
      />
      <SkinsNineTable title="Back" holes={holes.slice(9)} players={players} />
    </div>
  );
}

function SkinsNineTable({
  title,
  holes,
  players,
}: {
  title: string;
  holes: SkinHoleRow[];
  players: SkinPlayerView[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-medium">{title}</h3>
      <TableFrame className="w-full sm:w-fit">
        <Table className="w-full sm:w-max">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-12 px-2 text-center">Hole</TableHead>
              <TableHead className="w-10 px-2 text-center">Hcp</TableHead>
              {players.map((player) => (
                <TableHead key={player.id} className="w-16 px-2 text-center">
                  {player.firstName}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {holes.map((hole) => (
              <TableRow key={hole.hole}>
                <TableCell className="px-2 text-center text-base font-medium tabular-nums">
                  {hole.hole}
                </TableCell>
                <TableCell className="px-2 text-center text-base font-medium tabular-nums">
                  {formatScore(hole.holeHandicap)}
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
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableFrame>
    </div>
  );
}

function NetScore({
  score,
  adjusted,
  wonHole,
}: {
  score: number | null;
  adjusted: boolean;
  wonHole: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-full border border-transparent tabular-nums text-foreground",
        wonHole && "border-foreground",
        adjusted && "text-red-600 dark:text-red-500",
      )}
    >
      {formatScore(score)}
    </span>
  );
}

function toSkinsView(rounds: SkinsRound[]) {
  const roundsById = new Map(rounds.map((round) => [round.id, round]));
  const playersById = new Map(
    rounds.map((round) => {
      const name = displayName({ ...round, email: null });

      return [
        round.id,
        {
          id: round.id,
          name,
          firstName: round.firstName || name.split(" ")[0] || name,
          initials: getInitials({ ...round, email: null }),
          image: round.image,
          playingHandicap: round.playingHandicap,
          receivedStrokes: 0,
          skinsWon: 0,
        },
      ];
    }),
  );
  const players = rounds.map((round) => {
    const name = displayName({ ...round, email: null });

    return (
      playersById.get(round.id) ?? {
        id: round.id,
        name,
        firstName: round.firstName || name.split(" ")[0] || name,
        initials: getInitials({ ...round, email: null }),
        image: round.image,
        playingHandicap: round.playingHandicap,
        receivedStrokes: 0,
        skinsWon: 0,
      }
    );
  });
  const result = evaluateMatchPlay(
    rounds.map((round) => ({
      id: round.id,
      players: [
        {
          id: round.id,
          playingHandicap: round.playingHandicap,
          scores: toSkinsScores(round),
        },
      ],
    })),
  );
  const holeRows: SkinHoleRow[] = [];

  for (const hole of result.holes) {
    const winningRound =
      hole.winningTeamId == null
        ? null
        : roundsById.get(Number(hole.winningTeamId));

    holeRows.push({
      hole: hole.hole,
      holeHandicap: hole.holeHandicap,
      winningRoundId:
        hole.winningTeamId == null ? null : Number(hole.winningTeamId),
      players: hole.teams.map((team) => ({
        roundId: Number(team.teamId),
        netScore: team.netScore,
        receivedStrokes: team.receivedStrokes,
      })),
    });

    for (const team of hole.teams) {
      const player = playersById.get(Number(team.teamId));
      if (player) {
        player.receivedStrokes += team.receivedStrokes;
      }
    }

    if (winningRound == null) {
      continue;
    }

    const winningPlayer = playersById.get(winningRound.id);
    if (winningPlayer) {
      winningPlayer.skinsWon += 1;
    }

  }

  return {
    players,
    holes: holeRows,
  };
}

function isEligibleSkinsRound(
  round: RoundScoresTableRound,
): round is SkinsRound {
  return (
    round.recordedStrokesCount >= 18 &&
    Array.isArray(round.holes) &&
    round.holes.every((hole) => "handicap" in hole)
  );
}

function toSkinsScores(round: SkinsRound) {
  const scoresByHole = new Map(
    round.scores.map((score) => [score.hole, score]),
  );

  return round.holes.map((hole) => {
    const score = scoresByHole.get(hole.hole);

    return {
      hole: hole.hole,
      handicap: hole.handicap ?? null,
      strokes: score?.strokes ?? null,
    };
  });
}

function formatScore(score: number | null) {
  return score == null ? "-" : score;
}

function formatDecimalScore(score: number | null) {
  return score == null ? "-" : score.toFixed(1);
}
