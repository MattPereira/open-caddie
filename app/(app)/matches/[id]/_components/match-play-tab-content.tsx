import { displayName, getInitials } from "@/components/player-card";
import { TableFrame } from "@/components/responsive-table";
import type { RoundScoresTableRound } from "@/components/round-scores-table";
import { WinnerCard } from "@/components/winner-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
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

type StoredMatchPlayTeam = {
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
  const matchPlayRounds = rounds.filter(isMatchPlayRound);
  const matchPlayTeams = getMatchPlayTeams({
    format,
    rounds: matchPlayRounds,
    teams,
  });

  if (!matchPlayTeams) {
    return (
      <TabsContent value="match-play">
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Match play scoring is available for singles matches with 2 rounds
              or four-ball matches with 2 teams of 2.
            </p>
          </CardContent>
        </Card>
      </TabsContent>
    );
  }

  const matchPlay = toMatchPlayView(matchPlayTeams, format);

  return (
    <TabsContent value="match-play" className="flex flex-col gap-5">
      <Alert variant="info">
        <AlertDescription className="text-base">
          {getMatchPlayExplanation(format)}
        </AlertDescription>
      </Alert>

      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-medium">Summary</h3>
        <div className="grid gap-3 md:grid-cols-2 max-w-2xl">
          {matchPlay.teams.map((team) => (
            <WinnerCard
              key={team.id}
              playerName={team.name}
              initials={team.initials}
              image={team.image}
              secondary={`${formatTeamSecondary(team)} · Gets ${team.receivedStrokes}`}
              primaryLabel="Holes"
              primaryValue={formatTeamMatchStatus(team, matchPlay.finalStatus)}
              primaryValueAdjusted={isTeamBehind(team, matchPlay.finalStatus)}
            />
          ))}
        </div>
      </div>

      <MatchPlayTable holes={matchPlay.holes} teams={matchPlay.teams} />
    </TabsContent>
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
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-3 *:w-full sm:w-fit">
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
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-medium">{title}</h3>
      <TableFrame className="w-full sm:w-fit">
        <Table className="w-full sm:w-max">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-12 px-2 text-center">Hole</TableHead>
              <TableHead className="w-10 px-2 text-center">Hcp</TableHead>
              {teams.map((team) => (
                <TableHead key={team.id} className="w-16 px-2 text-center">
                  {team.label}
                </TableHead>
              ))}
              <TableHead className="w-28 px-2">Score</TableHead>
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
                {teams.map((team) => {
                  const result = hole.teams.find(
                    (teamResult) => teamResult.teamId === team.id,
                  );

                  return (
                    <TableCell
                      key={team.id}
                      className="px-2 text-center text-base tabular-nums"
                    >
                      <NetScore
                        score={result?.netScore ?? null}
                        adjusted={(result?.receivedStrokes ?? 0) > 0}
                        wonHole={hole.winningTeamId === team.id}
                      />
                    </TableCell>
                  );
                })}
                <TableCell className="px-2 text-base">
                  {formatMatchPlayStatus(hole.status, teams)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell
                colSpan={2 + teams.length}
                className="px-2 text-base font-medium"
              >
                {label}
              </TableCell>
              <TableCell className="px-2 text-base">
                {formatMatchPlayStatus(getLastStatus(holes), teams)}
              </TableCell>
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

function toMatchPlayView(teams: MatchPlayTeamView[], format: MatchFormat) {
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
      allowance: format === "four_ball_match_play" ? 0.9 : 1,
    },
  );
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
    holes: result.holes,
    finalStatus: result.finalStatus,
  };
}

function getMatchPlayExplanation(format: MatchFormat) {
  if (format === "singles_match_play") {
    return "Singles match play compares net scores hole by hole. The lowest-handicap player gets no strokes. Other players get their handicap difference, applied one stroke at a time on the hardest handicap holes.";
  }

  return "Four-ball match play compares each team's best net score hole by hole. The lowest-handicap player gets no strokes. Other players get 90% of their handicap difference, applied one stroke at a time on the hardest handicap holes.";
}

function formatMatchPlayStatus(
  status: MatchPlayStatus | null,
  teams: MatchPlayTeamView[],
) {
  if (status == null) return "-";
  if (status.leadingTeamId == null || status.holesUp === 0) return "Tied";

  const leadingTeam = teams.find((team) => team.id === status.leadingTeamId);
  return `${leadingTeam?.label ?? "Team"} +${status.holesUp}`;
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

function getLastStatus(holes: MatchPlayHoleView[]) {
  return holes.at(-1)?.status ?? null;
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
    name: formatStoredTeamName(team.name),
    label: formatStoredTeamName(team.name),
    initials: getTeamInitials(formatStoredTeamName(team.name)),
    image: null,
    rounds: team.rounds,
    receivedStrokes: 0,
  }));
}

function formatTeamSecondary(team: MatchPlayTeamView) {
  if (team.rounds.length === 1) {
    return `Hcp ${formatDecimalScore(team.rounds[0].playingHandicap)}`;
  }

  return team.rounds
    .map((round) => displayName({ ...round, email: null }))
    .join(" / ");
}

function getTeamInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
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
