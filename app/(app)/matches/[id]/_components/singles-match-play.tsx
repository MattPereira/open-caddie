import {
  MatchPlayCardRow,
  MatchPlayRules,
  MatchPlaySection,
  MatchPlayTable,
  type MatchPlayTeamView,
  toMatchPlayView,
} from "./match-play-shared";

export function SinglesMatchPlayContent({
  teams,
}: {
  teams: MatchPlayTeamView[];
}) {
  const matchPlay = toMatchPlayView(teams, "singles_match_play");

  return (
    <>
      <MatchPlayRules>
        Singles match play compares net scores hole by hole. The
        lowest-handicap player gets no strokes. The other player gets their
        handicap difference, applied one stroke at a time on the hardest
        handicap holes.
      </MatchPlayRules>
      <MatchPlaySection title="Head-to-Head">
        <MatchPlayCardRow matchPlay={matchPlay} />
      </MatchPlaySection>
      <MatchPlayTable holes={matchPlay.holes} teams={matchPlay.teams} />
    </>
  );
}
