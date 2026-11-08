import { displayName, getInitials } from "@/lib/players/player-name";
import type { ReactNode } from "react";
import { TableFrame } from "@/components/shared/responsive-table";
import type { NetScoringRound } from "@/lib/rounds/reads";
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
import type { MatchPlayStatus, ScoredContest } from "@/lib/matches/scoring";
import { cn } from "@/lib/utils";
import type { MatchFormat } from "../../schema";

type MatchPlayRound = NetScoringRound;

export type MatchPlayTeamView = {
  id: string;
  name: string;
  label: string;
  initials: string;
  image: string | null;
  rounds: MatchPlayRound[];
  receivedStrokes: number;
  holesWon: number;
};

export type StoredMatchPlayTeam = {
  id: number;
  name: string;
  rounds: NetScoringRound[];
};

type MatchPlayHoleView = ScoredContest["holes"][number];
export type MatchPlayView = Omit<ScoredContest, "teams"> & {
  teams: MatchPlayTeamView[];
};

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
      matchPlay,
    });
    const secondary = formatTeamSecondary(team);
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

/** Join semantic results to names, images and labels for rendering. */
export function toMatchPlayView(
  contest: ScoredContest,
  rounds: NetScoringRound[],
  storedTeams: StoredMatchPlayTeam[],
  format: MatchFormat,
): MatchPlayView {
  const roundsById = new Map(
    [...rounds, ...storedTeams.flatMap((team) => team.rounds)].map((round) => [
      round.id,
      round,
    ]),
  );
  return {
    ...contest,
    teams: contest.teams.map((team) => {
      const teamRounds = team.roundIds.map((id) => roundsById.get(id)!);
      if (format === "four_ball_match_play") {
        const stored = storedTeams.find(
          (candidate) => String(candidate.id) === team.id,
        )!;
        return {
          ...team,
          name: formatTeamPlayerInitials({ rounds: teamRounds }),
          label: formatStoredTeamName(stored.name),
          initials: formatTeamPlayerInitials({ rounds: teamRounds }),
          image: teamRounds.find((round) => round.image)?.image ?? null,
          rounds: teamRounds,
        };
      }
      const round = teamRounds[0];
      const name = displayName({ ...round, email: null });
      return {
        ...team,
        name,
        label: round.firstName || name.split(" ")[0] || name,
        initials: getInitials({ ...round, email: null }),
        image: round.image,
        rounds: teamRounds,
      };
    }),
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
  matchPlay,
}: {
  team: MatchPlayTeamView;
  matchPlay: MatchPlayView;
}) {
  if (matchPlay.state === "unstarted") return undefined;
  if (matchPlay.state === "complete") return "Final";
  if (
    matchPlay.state === "closed" &&
    team.id === matchPlay.finalStatus.leadingTeamId
  ) {
    return `${matchPlay.finalStatus.holesUp} & ${matchPlay.holesRemaining}`;
  }
  return `Thru ${matchPlay.holesCompleted}`;
}

function formatTeamMatchStatus(
  team: MatchPlayTeamView,
  status: MatchPlayStatus,
) {
  if (status.leadingTeamId == null || status.holesUp === 0) return "AS";
  return `${status.holesUp} ${status.leadingTeamId === team.id ? "UP" : "DN"}`;
}

function formatTeamSecondary(team: MatchPlayTeamView) {
  return `${team.holesWon} ${team.holesWon === 1 ? "hole" : "holes"} won`;
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
