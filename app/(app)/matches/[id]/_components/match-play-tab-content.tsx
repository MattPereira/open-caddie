import { Card, CardContent } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import type { MatchFormat } from "../../schema";
import { FourBallMatchPlayContent } from "./four-ball-match-play";
import {
  getMatchPlayTeams,
  isMatchPlayRound,
  type MatchPlayHole,
  type MatchPlayRound,
  type StoredMatchPlayTeam,
} from "./match-play-shared";
import { SinglesMatchPlayContent } from "./singles-match-play";
import { ThreeBallMatchPlayContent } from "./three-ball-match-play";

export type { StoredMatchPlayTeam };

export function MatchPlayTabContent({
  format,
  rounds,
  holes,
  teams = [],
}: {
  format: MatchFormat;
  rounds: MatchPlayRound[];
  holes: MatchPlayHole[];
  teams?: StoredMatchPlayTeam[];
}) {
  return (
    <TabsContent value="match" className="flex flex-col gap-5">
      <MatchPlayContent
        format={format}
        rounds={rounds}
        holes={holes}
        teams={teams}
      />
    </TabsContent>
  );
}

export function MatchPlayContent({
  format,
  rounds,
  holes,
  teams = [],
}: {
  format: MatchFormat;
  rounds: MatchPlayRound[];
  holes: MatchPlayHole[];
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
    return <ThreeBallMatchPlayContent teams={matchPlayTeams} holes={holes} />;
  }

  if (format === "four_ball_match_play") {
    return <FourBallMatchPlayContent teams={matchPlayTeams} holes={holes} />;
  }

  return <SinglesMatchPlayContent teams={matchPlayTeams} holes={holes} />;
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
