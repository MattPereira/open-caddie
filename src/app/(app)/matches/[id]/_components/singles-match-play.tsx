import { matchPlayContestTitle } from "@/modules/matches";
import {
  MatchPlayCardRow,
  MatchPlayRules,
  MatchPlaySection,
  MatchPlayTable,
  type MatchPlayView,
} from "./match-play-shared";

export function SinglesMatchPlayContent({
  matchPlay,
}: {
  matchPlay: MatchPlayView;
}) {
  return (
    <>
      <MatchPlayRules>
        Singles match play compares net scores hole by hole. The lowest-handicap
        player gets no strokes. The other player gets their handicap difference,
        applied one stroke at a time on the hardest handicap holes.
      </MatchPlayRules>
      <MatchPlaySection
        title={matchPlayContestTitle(
          "singles_match_play",
          matchPlay.teams.map((team) => team.name),
        )}
      >
        <MatchPlayCardRow matchPlay={matchPlay} />
      </MatchPlaySection>
      <MatchPlayTable holes={matchPlay.holes} teams={matchPlay.teams} />
    </>
  );
}
