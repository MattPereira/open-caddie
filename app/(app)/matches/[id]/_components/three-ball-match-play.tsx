import {
  MatchPlayCardRow,
  MatchPlayRules,
  MatchPlayTable,
  type MatchPlayTeamView,
  toMatchPlayView,
} from "./match-play-shared";

export function ThreeBallMatchPlayContent({
  teams,
}: {
  teams: MatchPlayTeamView[];
}) {
  return (
    <>
      <MatchPlayRules>
        Three-ball match play is three singles matches played at the same time.
        Each player has one head-to-head match against each of the other two
        players, so the group produces three pairings: A vs B, A vs C, and B vs
        C. Each pairing is scored independently using singles match play.
      </MatchPlayRules>
      <div className="grid grid-cols-1 gap-6">
        {getThreeBallPairings(teams).map(([firstTeam, secondTeam]) => {
          const matchPlay = toMatchPlayView(
            [firstTeam, secondTeam],
            "singles_match_play",
          );

          return (
            <section
              key={`${firstTeam.id}-${secondTeam.id}`}
              className="grid gap-3"
            >
              <MatchPlayCardRow
                format="singles_match_play"
                matchPlay={matchPlay}
              />
              <MatchPlayTable holes={matchPlay.holes} teams={matchPlay.teams} />
            </section>
          );
        })}
      </div>
    </>
  );
}

function getThreeBallPairings(teams: MatchPlayTeamView[]) {
  return [
    [teams[0], teams[1]],
    [teams[0], teams[2]],
    [teams[1], teams[2]],
  ] as const;
}
