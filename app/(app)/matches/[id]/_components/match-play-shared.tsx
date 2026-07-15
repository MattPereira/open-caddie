import { displayName, getInitials } from "@/lib/players/player-name";
import type { ReactNode } from "react";
import { TableFrame } from "@/components/shared/responsive-table";
import type { RoundScoresTableRound } from "@/components/features/scores/round-scores-table";
import { WinnerCard } from "@/components/domain/winner-card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { evaluateMatchPlay, type MatchPlayStatus } from "@/lib/matches";
import { cn } from "@/lib/utils";
import type { MatchFormat } from "../../schema";

export type MatchPlayRound = RoundScoresTableRound & {
  userId: string;
  holes: {
    hole: number;
    par: number;
    handicap: number | null;
  }[];
};

export type MatchPlayTeamView = {
  id: string;
  name: string;
  label: string;
  initials: string;
  image: string | null;
  rounds: MatchPlayRound[];
  receivedStrokes: number;
};

export type StoredMatchPlayTeam = {
  id: number;
  name: string;
  rounds: RoundScoresTableRound[];
};

type MatchPlayHoleView = ReturnType<typeof toMatchPlayView>["holes"][number];
export type MatchPlayView = ReturnType<typeof toMatchPlayView>;

export type TeamTone = "winning" | "losing" | "neutral";

export type MatchPlayTeamCardProps = {
  team: MatchPlayTeamView;
  label: string;
  secondary: ReactNode;
  primaryValue: string;
  primaryLabel?: string;
  tone: TeamTone;
};

export function MatchPlayRules({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-3xl">
      <Accordion type="single" collapsible className="rounded-lg border px-4">
        <AccordionItem value="rules">
          <AccordionTrigger className="text-base">
            How match play works
          </AccordionTrigger>
          <AccordionContent className="text-base text-muted-foreground">
            {children}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

export function MatchPlayCardRow({
  matchPlay,
  renderTeamCard,
}: {
  matchPlay: MatchPlayView;
  renderTeamCard?: (props: MatchPlayTeamCardProps) => ReactNode;
}) {
  const teamCards = matchPlay.teams.map((team, teamIndex) => {
    const primaryValue = formatTeamMatchStatus(team, matchPlay.finalStatus);
    const primaryLabel = formatMatchStatusSubtext({
      team,
      status: matchPlay.finalStatus,
      holesCompleted: matchPlay.holesCompleted,
    });
    const secondary = formatTeamSecondary(team, matchPlay.holes);
    const tone = getTeamTone(team, matchPlay.finalStatus);

    if (renderTeamCard) {
      return renderTeamCard({
        team,
        label: `Team ${String.fromCharCode(65 + teamIndex)}`,
        secondary,
        primaryValue,
        primaryLabel,
        tone,
      });
    }

    return (
      <WinnerCard
        key={team.id}
        playerName={team.name}
        initials={team.initials}
        image={team.image}
        secondary={secondary}
        primaryValue={primaryValue}
        primaryLabel={primaryLabel}
        primaryValueTone={tone}
      />
    );
  });

  return (
    <div className="max-w-3xl flex flex-col gap-5">
      <div className="grid w-full grid-cols-1 items-center gap-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-3">
        {teamCards[0]}
        <div className="flex items-center justify-center text-sm font-semibold text-muted-foreground">
          VS
        </div>
        {teamCards[1]}
      </div>
    </div>
  );
}

export function MatchPlaySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <h3 className="font-medium text-lg">{title}</h3>
      {children}
    </section>
  );
}

export function MatchPlayTable({
  holes,
  teams,
}: {
  holes: MatchPlayHoleView[];
  teams: MatchPlayTeamView[];
}) {
  const frontNine = holes.slice(0, 9);
  const backNine = holes.slice(9);

  return (
    <>
      <div className="hidden lg:block">
        <MatchPlayFullTable holes={holes} teams={teams} />
      </div>
      <div className="lg:hidden">
        <Tabs defaultValue="front" className="w-full gap-5 sm:w-fit">
          <TabsList className="grid w-full grid-cols-2 group-data-horizontal/tabs:h-11 sm:w-72">
            <TabsTrigger value="front" className="px-4 text-base">
              Front
            </TabsTrigger>
            <TabsTrigger value="back" className="px-4 text-base">
              Back
            </TabsTrigger>
          </TabsList>
          <TabsContent value="front">
            <MatchPlayNineTable label="Out" holes={frontNine} teams={teams} />
          </TabsContent>
          <TabsContent value="back">
            <MatchPlayNineTable label="In" holes={backNine} teams={teams} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function MatchPlayFullTable({
  holes,
  teams,
}: {
  holes: MatchPlayHoleView[];
  teams: MatchPlayTeamView[];
}) {
  const frontNine = holes.slice(0, 9);
  const backNine = holes.slice(9);
  const allRounds = teams.flatMap((team) => team.rounds);

  const outTotals = new Map<number, number>();
  const inTotals = new Map<number, number>();
  allRounds.forEach((round) => {
    outTotals.set(
      round.id,
      frontNine.reduce((count, hole) => {
        const s = hole.playerScores.find((p) => p.roundId === round.id);
        return count + (s?.wonHole ? 1 : 0);
      }, 0),
    );
    inTotals.set(
      round.id,
      backNine.reduce((count, hole) => {
        const s = hole.playerScores.find((p) => p.roundId === round.id);
        return count + (s?.wonHole ? 1 : 0);
      }, 0),
    );
  });

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
          {teams.flatMap((team, teamIndex) => {
            const teamOut = team.rounds.reduce(
              (sum, round) => sum + (outTotals.get(round.id) ?? 0),
              0,
            );
            const teamIn = team.rounds.reduce(
              (sum, round) => sum + (inTotals.get(round.id) ?? 0),
              0,
            );
            const teamTotal = teamOut + teamIn;
            const isTeamDivider = teamIndex < teams.length - 1;
            return team.rounds.map((round, roundIndex) => (
              <TableRow
                key={round.id}
                className={cn(
                  isTeamDivider &&
                    roundIndex === team.rounds.length - 1 &&
                    "[&>td]:border-b [&>td]:border-b-foreground/20",
                )}
              >
                <TableCell className="sticky left-0 z-10 bg-card font-medium">
                  {formatRoundLabel(round)}
                </TableCell>
                {frontNine.map((hole) => {
                  const result = hole.playerScores.find(
                    (s) => s.roundId === round.id,
                  );
                  return (
                    <TableCell
                      key={hole.hole}
                      className="px-1 py-2 text-center tabular-nums"
                    >
                      <NetScore
                        score={result?.netScore ?? null}
                        adjusted={(result?.receivedStrokes ?? 0) > 0}
                        wonHole={result?.wonHole ?? false}
                      />
                    </TableCell>
                  );
                })}
                {roundIndex === 0 ? (
                  <TableCell
                    rowSpan={team.rounds.length}
                    className={cn(
                      "w-12 border-x bg-muted/20 px-1 py-2 text-center font-medium tabular-nums",
                      isTeamDivider && "border-b border-b-foreground/20",
                    )}
                  >
                    {`+${teamOut}`}
                  </TableCell>
                ) : null}
                {backNine.map((hole) => {
                  const result = hole.playerScores.find(
                    (s) => s.roundId === round.id,
                  );
                  return (
                    <TableCell
                      key={hole.hole}
                      className="px-1 py-2 text-center tabular-nums"
                    >
                      <NetScore
                        score={result?.netScore ?? null}
                        adjusted={(result?.receivedStrokes ?? 0) > 0}
                        wonHole={result?.wonHole ?? false}
                      />
                    </TableCell>
                  );
                })}
                {roundIndex === 0 ? (
                  <TableCell
                    rowSpan={team.rounds.length}
                    className={cn(
                      "w-12 border-x bg-muted/20 px-1 py-2 text-center font-medium tabular-nums",
                      isTeamDivider && "border-b border-b-foreground/20",
                    )}
                  >
                    {`+${teamIn}`}
                  </TableCell>
                ) : null}
                {roundIndex === 0 ? (
                  <TableCell
                    rowSpan={team.rounds.length}
                    className={cn(
                      "w-12 border-x bg-muted/30 px-1 py-2 text-center font-semibold tabular-nums",
                      isTeamDivider && "border-b border-b-foreground/20",
                    )}
                  >
                    {`+${teamTotal}`}
                  </TableCell>
                ) : null}
              </TableRow>
            ));
          })}
        </TableBody>
      </Table>
    </TableFrame>
  );
}

function MatchPlayNineTable({
  label,
  holes,
  teams,
}: {
  label: string;
  holes: MatchPlayHoleView[];
  teams: MatchPlayTeamView[];
}) {
  const roundTotals = new Map<number, number>();
  teams.forEach((team) =>
    team.rounds.forEach((round) => {
      const total = holes.reduce((count, hole) => {
        const result = hole.playerScores.find(
          (playerScore) => playerScore.roundId === round.id,
        );
        return count + (result?.wonHole ? 1 : 0);
      }, 0);
      roundTotals.set(round.id, total);
    }),
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
              {teams.flatMap((team, teamIndex) =>
                team.rounds.map((round, roundIndex) => (
                  <TableHead
                    key={round.id}
                    className={cn(
                      "w-14 px-1 text-center sm:w-16",
                      teamIndex > 0 &&
                        roundIndex === 0 &&
                        "border-l border-l-foreground/20",
                    )}
                  >
                    <span className="block truncate">
                      {formatRoundInitials(round)}
                    </span>
                  </TableHead>
                )),
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {holes.map((hole) => (
              <TableRow key={hole.hole}>
                <TableCell className="border-r bg-muted/40 px-2 text-center text-base font-medium tabular-nums">
                  {hole.hole}
                </TableCell>
                {teams.flatMap((team, teamIndex) =>
                  team.rounds.map((round, roundIndex) => {
                    const result = hole.playerScores.find(
                      (playerScore) => playerScore.roundId === round.id,
                    );

                    return (
                      <TableCell
                        key={round.id}
                        className={cn(
                          "px-1 text-center text-base tabular-nums",
                          teamIndex > 0 &&
                            roundIndex === 0 &&
                            "border-l border-l-foreground/20",
                        )}
                      >
                        <NetScore
                          score={result?.netScore ?? null}
                          adjusted={(result?.receivedStrokes ?? 0) > 0}
                          wonHole={result?.wonHole ?? false}
                        />
                      </TableCell>
                    );
                  }),
                )}
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell
                colSpan={1}
                className="border-r bg-muted/60 px-2 text-center text-base font-medium text-muted-foreground"
              >
                {label}
              </TableCell>
              {teams.map((team, teamIndex) => {
                const teamTotal = team.rounds.reduce(
                  (sum, round) => sum + (roundTotals.get(round.id) ?? 0),
                  0,
                );
                return (
                  <TableCell
                    key={team.id}
                    colSpan={team.rounds.length}
                    className={cn(
                      "px-1 text-center text-base font-medium tabular-nums",
                      teamIndex > 0 && "border-l border-l-foreground/20",
                    )}
                  >
                    {`+${teamTotal}`}
                  </TableCell>
                );
              })}
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

export function toMatchPlayView(
  teams: MatchPlayTeamView[],
  format: MatchFormat,
) {
  const allowance = format === "four_ball_match_play" ? 0.9 : 1;
  const result = evaluateMatchPlay(
    teams.map((team) => ({
      id: team.id,
      players: team.rounds.map((round) => ({
        id: round.id,
        playingHandicap: round.playingHandicap,
        scores: toMatchPlayScores(round),
      })),
    })),
    {
      allowance,
    },
  );
  const holesWithPlayerScores = result.holes.map((hole) => ({
    ...hole,
    playerScores: teams.flatMap((team) => {
      const teamResult = hole.teams.find(
        (candidate) => candidate.teamId === team.id,
      );
      const winningRoundId =
        hole.winningTeamId === team.id
          ? (teamResult?.players.find(
              (player) =>
                player.netScore != null &&
                player.netScore === teamResult.netScore,
            )?.playerId ?? null)
          : null;

      return team.rounds.map((round) => {
        const playerResult = teamResult?.players.find(
          (candidate) => candidate.playerId === round.id,
        );

        return {
          roundId: round.id,
          teamId: team.id,
          netScore: playerResult?.netScore ?? null,
          receivedStrokes: playerResult?.receivedStrokes ?? 0,
          wonHole: round.id === winningRoundId,
        };
      });
    }),
  }));
  const teamsWithStrokes = teams.map((team) => {
    const firstHole = result.holes[0];
    const totalReceivedStrokes = firstHole
      ? result.holes.reduce((total, hole) => {
          const teamResult = hole.teams.find(
            (candidate) => candidate.teamId === team.id,
          );

          return total + (teamResult?.receivedStrokes ?? 0);
        }, 0)
      : 0;

    return {
      ...team,
      receivedStrokes: totalReceivedStrokes,
    };
  });

  const holesCompleted = result.holes.filter((hole) =>
    hole.teams.every((team) => team.netScore != null),
  ).length;

  return {
    teams: teamsWithStrokes,
    holes: holesWithPlayerScores,
    finalStatus: result.finalStatus,
    holesCompleted,
  };
}

function getTeamTone(
  team: MatchPlayTeamView,
  status: MatchPlayStatus,
): TeamTone {
  if (status.leadingTeamId == null || status.holesUp === 0) return "neutral";
  return status.leadingTeamId === team.id ? "winning" : "losing";
}

function formatMatchStatusSubtext({
  team,
  status,
  holesCompleted,
}: {
  team: MatchPlayTeamView;
  status: MatchPlayStatus;
  holesCompleted: number;
}) {
  if (holesCompleted === 0) return undefined;

  const holesRemaining = 18 - holesCompleted;
  const isTied = status.leadingTeamId == null || status.holesUp === 0;

  if (holesRemaining === 0) {
    return isTied ? "Final" : "Final";
  }

  if (!isTied && status.holesUp > holesRemaining) {
    return team.id === status.leadingTeamId
      ? `${status.holesUp} & ${holesRemaining}`
      : `Thru ${holesCompleted}`;
  }

  return `Thru ${holesCompleted}`;
}

function formatTeamMatchStatus(
  team: MatchPlayTeamView,
  status: MatchPlayStatus,
) {
  if (status.leadingTeamId == null || status.holesUp === 0) return "AS";
  return `${status.holesUp} ${status.leadingTeamId === team.id ? "UP" : "DN"}`;
}

export function isMatchPlayRound(
  round: RoundScoresTableRound,
): round is MatchPlayRound {
  return (
    typeof round.userId === "string" &&
    Array.isArray(round.holes) &&
    round.holes.every((hole) => "handicap" in hole)
  );
}

function toMatchPlayScores(round: MatchPlayRound) {
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

export function getMatchPlayTeams({
  format,
  rounds,
  teams,
}: {
  format: MatchFormat;
  rounds: MatchPlayRound[];
  teams: StoredMatchPlayTeam[];
}) {
  if (format !== "four_ball_match_play") {
    const requiredRoundCount = format === "singles_match_play" ? 2 : 3;
    if (rounds.length !== requiredRoundCount) return null;
    return rounds.map((round) => {
      const name = displayName({ ...round, email: null });
      const label = round.firstName || name.split(" ")[0] || name;

      return {
        id: round.userId,
        name,
        label,
        initials: getInitials({ ...round, email: null }),
        image: round.image,
        rounds: [round],
        receivedStrokes: 0,
      };
    });
  }

  const matchTeams = teams.map((team) => ({
    ...team,
    rounds: team.rounds.filter(isMatchPlayRound),
  }));

  if (
    matchTeams.length !== 2 ||
    matchTeams.some((team) => team.rounds.length !== 2)
  ) {
    return null;
  }

  return matchTeams.map((team) => ({
    id: String(team.id),
    name: formatTeamPlayerInitials({ rounds: team.rounds }),
    label: formatStoredTeamName(team.name),
    initials: formatTeamPlayerInitials({ rounds: team.rounds }),
    image: team.rounds.find((round) => round.image)?.image ?? null,
    rounds: team.rounds,
    receivedStrokes: 0,
  }));
}

function formatTeamSecondary(
  team: MatchPlayTeamView,
  holes: MatchPlayHoleView[],
) {
  const holesWon = holes.reduce(
    (count, hole) =>
      count +
      (hole.playerScores.some(
        (score) => score.teamId === team.id && score.wonHole,
      )
        ? 1
        : 0),
    0,
  );

  return `${holesWon} ${holesWon === 1 ? "hole" : "holes"} won`;
}

function formatRoundLabel(round: MatchPlayRound) {
  const name = displayName({ ...round, email: null });
  return round.firstName || name.split(" ")[0] || name;
}

function formatRoundInitials(round: MatchPlayRound) {
  return getInitials({ ...round, email: null });
}

function formatTeamPlayerInitials(team: { rounds: MatchPlayRound[] }) {
  return team.rounds
    .map((round) => getInitials({ ...round, email: null }))
    .join(" · ");
}

function formatStoredTeamName(name: string) {
  if (name === "Team 1") return "Team A";
  if (name === "Team 2") return "Team B";
  return name;
}

function formatScore(score: number | null) {
  return score == null ? "-" : score;
}
