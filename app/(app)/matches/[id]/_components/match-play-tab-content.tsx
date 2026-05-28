import type { RoundScoresTableRound } from "@/components/round-scores-table";
import { Card, CardContent } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import type { MatchFormat } from "../../schema";
import { FourBallMatchPlayContent } from "./four-ball-match-play";
import {
  getMatchPlayTeams,
  isMatchPlayRound,
  type StoredMatchPlayTeam,
} from "./match-play-shared";
import { SinglesMatchPlayContent } from "./singles-match-play";
import { ThreeBallMatchPlayContent } from "./three-ball-match-play";

export type { StoredMatchPlayTeam };

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
  const matchPlayTeams = getMatchPlayTeams({
    format,
    rounds: rounds.filter(isMatchPlayRound),
    teams,
  });

  if (!matchPlayTeams) {
    return <MatchPlayUnavailable />;
  }

  if (format === "three_ball_match_play") {
    return <ThreeBallMatchPlayContent teams={matchPlayTeams} />;
  }

  if (format === "four_ball_match_play") {
    return <FourBallMatchPlayContent teams={matchPlayTeams} />;
  }

  return <SinglesMatchPlayContent teams={matchPlayTeams} />;
}

function MatchPlayUnavailable() {
  return (
    <Card className="border-dashed">
      <CardContent className="py-10 text-center">
        <p className="text-sm text-muted-foreground">
          Match play scoring is available for singles matches with 2 rounds,
          three-ball matches with 3 rounds, or four-ball matches with 2 teams of
          2.
        </p>
      </CardContent>
    </Card>
  );
}
