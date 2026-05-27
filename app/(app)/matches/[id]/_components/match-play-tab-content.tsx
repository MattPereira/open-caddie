import { displayName, getInitials } from "@/components/player-card";
import { TableFrame } from "@/components/responsive-table";
import type { RoundScoresTableRound } from "@/components/round-scores-table";
import { WinnerCard } from "@/components/winner-card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { evaluateMatchPlay, type MatchPlayStatus } from "@/lib/match-play";
import { cn } from "@/lib/utils";
import type { MatchFormat } from "../../schema";

type MatchPlayRound = RoundScoresTableRound & {
  userId: string;
  holes: {
    hole: number;
    par: number;
    handicap: number | null;
  }[];
};

type MatchPlayTeamView = {
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

export function MatchPlayTabContent({
  format,
  rounds,
  teams = [],
}: {
  format: MatchFormat;
  rounds: RoundScoresTableRound[];
  teams?: StoredMatchPlayTeam[];
}) {
  return (
    <TabsContent value="match-play" className="flex flex-col gap-5">
      <MatchPlayContent format={format} rounds={rounds} teams={teams} />
    </TabsContent>
  );
}

export function MatchPlayContent({
  format,
  rounds,
  teams = [],
}: {
  format: MatchFormat;
  rounds: RoundScoresTableRound[];
  teams?: StoredMatchPlayTeam[];
}) {
  const matchPlayRounds = rounds.filter(isMatchPlayRound);
  const matchPlayTeams = getMatchPlayTeams({
    format,
    rounds: matchPlayRounds,
    teams,
  });

  if (!matchPlayTeams) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Match play scoring is available for singles matches with 2 rounds or
            four-ball matches with 2 teams of 2.
          </p>
        </CardContent>
      </Card>
    );
  }

  const matchPlay = toMatchPlayView(matchPlayTeams, format);

  return (
    <>
      <div className="max-w-3xl flex flex-col gap-5">
        <Accordion type="single" collapsible className="rounded-lg border px-4">
          <AccordionItem value="rules">
            <AccordionTrigger className="text-base">
              How match play works
            </AccordionTrigger>
            <AccordionContent className="text-base text-muted-foreground">
              {getMatchPlayExplanation(format)}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-medium">Summary</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 w-full">
            {matchPlay.teams.map((team) =>
              format === "four_ball_match_play" ? (
                <TeamWinnerCard
                  key={team.id}
                  team={team}
                  secondary={formatTeamSecondary(team, format)}
                  primaryValue={formatTeamMatchStatus(
                    team,
                    matchPlay.finalStatus,
                  )}
                  primaryValueAdjusted={isTeamBehind(
                    team,
                    matchPlay.finalStatus,
                  )}
                />
              ) : (
                <WinnerCard
                  key={team.id}
                  playerName={team.name}
                  initials={team.initials}
                  image={team.image}
                  secondary={formatTeamSecondary(team, format)}
                  primaryValue={formatTeamMatchStatus(
                    team,
                    matchPlay.finalStatus,
                  )}
                  primaryValueAdjusted={isTeamBehind(
                    team,
                    matchPlay.finalStatus,
                  )}
                />
              ),
            )}
          </div>
        </div>
      </div>

      <MatchPlayTable holes={matchPlay.holes} teams={matchPlay.teams} />
    </>
  );
}

function MatchPlayTable({
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-3 *:w-full sm:w-fit lg:hidden">
        <MatchPlayNineTable
          title="Front"
          label="Out"
          holes={frontNine}
          teams={teams}
        />
        <MatchPlayNineTable
          title="Back"
          label="In"
          holes={backNine}
          teams={teams}
        />
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
                    "[&>td]:border-b-2 [&>td]:border-b-foreground/40",
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
                      isTeamDivider && "border-b-2 border-b-foreground/40",
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
                      isTeamDivider && "border-b-2 border-b-foreground/40",
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
                      isTeamDivider && "border-b-2 border-b-foreground/40",
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
  title,
  label,
  holes,
  teams,
}: {
  title: string;
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
      <h3 className="text-lg font-medium">{title}</h3>
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
                        "border-l-2 border-l-foreground/40",
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
                            "border-l-2 border-l-foreground/40",
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
                      teamIndex > 0 && "border-l-2 border-l-foreground/40",
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

function TeamWinnerCard({
  team,
  secondary,
  primaryValue,
  primaryValueAdjusted,
}: {
  team: MatchPlayTeamView;
  secondary: string;
  primaryValue: string;
  primaryValueAdjusted: boolean;
}) {
  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="flex min-h-20 items-center gap-3 px-0">
        <TeamAvatarPair team={team} />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-3">
          <div className="truncate text-base font-medium sm:text-lg">
            {team.name}
          </div>
          <CardDescription className="truncate text-sm leading-snug">
            {secondary}
          </CardDescription>
        </div>
        <div className="flex shrink-0 flex-col items-end justify-center pr-3 leading-none">
          <span
            className={cn(
              "text-lg  tabular-nums",
              primaryValueAdjusted && "text-red-600 dark:text-red-500",
            )}
          >
            {primaryValue}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function TeamAvatarPair({ team }: { team: MatchPlayTeamView }) {
  return (
    <div className="flex h-20 shrink-0">
      {team.rounds.slice(0, 2).map((round) => {
        const name = displayName({ ...round, email: null });
        return (
          <div key={round.id} className="size-20">
            <Avatar className="size-full rounded-none">
              {round.image ? (
                <AvatarImage src={round.image} alt={name} />
              ) : null}
              <AvatarFallback className="rounded-none text-base">
                {getInitials({ ...round, email: null })}
              </AvatarFallback>
            </Avatar>
          </div>
        );
      })}
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

function toMatchPlayView(teams: MatchPlayTeamView[], format: MatchFormat) {
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
  const roundAllowances = getRoundAllowances(teams, allowance);
  const holesWithPlayerScores = result.holes.map((hole) => ({
    ...hole,
    playerScores: teams.flatMap((team) => {
      const teamResult = hole.teams.find(
        (candidate) => candidate.teamId === team.id,
      );
      const playersData = team.rounds.map((round) => ({
        round,
        playerScore: getRoundHoleScore({
          round,
          hole: hole.hole,
          totalReceivedStrokes: roundAllowances.get(round.id) ?? 0,
        }),
      }));
      const winningRoundId =
        hole.winningTeamId === team.id
          ? (playersData.find(
              ({ playerScore }) =>
                playerScore.netScore != null &&
                playerScore.netScore === teamResult?.netScore,
            )?.round.id ?? null)
          : null;

      return playersData.map(({ round, playerScore }) => ({
        roundId: round.id,
        teamId: team.id,
        netScore: playerScore.netScore,
        receivedStrokes: playerScore.receivedStrokes,
        wonHole: round.id === winningRoundId,
      }));
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

  return {
    teams: teamsWithStrokes,
    holes: holesWithPlayerScores,
    finalStatus: result.finalStatus,
  };
}

function getMatchPlayExplanation(format: MatchFormat) {
  if (format === "singles_match_play") {
    return "Singles match play compares net scores hole by hole. The lowest-handicap player gets no strokes. Other players get their handicap difference, applied one stroke at a time on the hardest handicap holes.";
  }

  return "Four-ball match play compares each team's best net score hole by hole. The lowest-handicap player gets no strokes. Other players get 90% of their handicap difference, applied one stroke at a time on the hardest handicap holes.";
}

function formatTeamMatchStatus(
  team: MatchPlayTeamView,
  status: MatchPlayStatus,
) {
  if (status.leadingTeamId == null || status.holesUp === 0) return "Tied";
  return `${status.leadingTeamId === team.id ? "+" : "-"}${status.holesUp}`;
}

function isTeamBehind(team: MatchPlayTeamView, status: MatchPlayStatus) {
  return status.leadingTeamId != null && status.leadingTeamId !== team.id;
}

function isMatchPlayRound(
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

function getRoundAllowances(teams: MatchPlayTeamView[], allowance: number) {
  const rounds = teams.flatMap((team) => team.rounds);
  if (rounds.length === 0) return new Map<MatchPlayRound["id"], number>();

  const lowestHandicap = Math.min(
    ...rounds.map((round) => round.playingHandicap ?? 0),
  );

  return new Map(
    rounds.map((round) => [
      round.id,
      Math.max(
        0,
        Math.round(((round.playingHandicap ?? 0) - lowestHandicap) * allowance),
      ),
    ]),
  );
}

function getRoundHoleScore({
  round,
  hole,
  totalReceivedStrokes,
}: {
  round: MatchPlayRound;
  hole: number;
  totalReceivedStrokes: number;
}) {
  const score = round.scores.find((candidate) => candidate.hole === hole);
  const holeHandicap =
    round.holes.find((candidate) => candidate.hole === hole)?.handicap ?? null;
  const receivedStrokes = getReceivedStrokesOnHole({
    totalReceivedStrokes,
    holeHandicap,
  });

  return {
    netScore: score?.strokes == null ? null : score.strokes - receivedStrokes,
    receivedStrokes,
  };
}

function getReceivedStrokesOnHole({
  totalReceivedStrokes,
  holeHandicap,
}: {
  totalReceivedStrokes: number;
  holeHandicap: number | null;
}) {
  if (holeHandicap == null || totalReceivedStrokes <= 0) return 0;

  return (
    Math.floor(totalReceivedStrokes / 18) +
    (holeHandicap <= totalReceivedStrokes % 18 ? 1 : 0)
  );
}

function getMatchPlayTeams({
  format,
  rounds,
  teams,
}: {
  format: MatchFormat;
  rounds: MatchPlayRound[];
  teams: StoredMatchPlayTeam[];
}) {
  if (format === "singles_match_play") {
    if (rounds.length !== 2) return null;
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

function formatTeamSecondary(team: MatchPlayTeamView, format: MatchFormat) {
  if (team.rounds.length === 1) {
    const handicap = `Hcp ${formatDecimalScore(team.rounds[0].playingHandicap)}`;
    return format === "singles_match_play"
      ? `${handicap} · Gets ${team.receivedStrokes}`
      : handicap;
  }

  return team.rounds.map((round) => formatRoundLabel(round)).join(" · ");
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

function formatDecimalScore(score: number | null) {
  return score == null ? "-" : score.toFixed(1);
}
