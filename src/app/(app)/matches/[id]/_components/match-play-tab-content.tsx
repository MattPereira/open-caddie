import type { HandicapHole, NetScoringRound } from "@/lib/rounds/reads";
import { Card, CardContent } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import type { MatchFormat } from "../../schema";
import { scoreMatchPlay } from "@/lib/matches/scoring";
import { FourBallMatchPlayContent } from "./four-ball-match-play";
import { toMatchPlayView, type StoredMatchPlayTeam } from "./match-play-shared";
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
  rounds: NetScoringRound[];
  holes: HandicapHole[];
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
  rounds: NetScoringRound[];
  holes: HandicapHole[];
  teams?: StoredMatchPlayTeam[];
}) {
  const result = scoreMatchPlay({ format, rounds, teams, holes });
  if (result.status === "unavailable") return <MatchPlayUnavailable />;

  const matches = result.contests.map((contest) =>
    toMatchPlayView(contest, rounds, teams),
  );
  if (format === "three_ball_match_play") {
    return <ThreeBallMatchPlayContent matches={matches} />;
  }
  if (format === "four_ball_match_play") {
    return <FourBallMatchPlayContent matchPlay={matches[0]} />;
  }
  return <SinglesMatchPlayContent matchPlay={matches[0]} />;
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
