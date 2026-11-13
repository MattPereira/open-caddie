import {
  MatchPlayCardRow,
  MatchPlayRules,
  MatchPlaySection,
  MatchPlayTable,
  type MatchPlayView,
} from "./match-play-shared";

export function ThreeBallMatchPlayContent({
  matches,
}: {
  matches: MatchPlayView[];
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
        {matches.map((matchPlay) => {
          return (
            <section
              key={JSON.stringify(matchPlay.teams.map((team) => team.id))}
              className="grid gap-3"
            >
              <MatchPlaySection title="Head-to-Head">
                <MatchPlayCardRow matchPlay={matchPlay} />
              </MatchPlaySection>
              <MatchPlayTable holes={matchPlay.holes} teams={matchPlay.teams} />
            </section>
          );
        })}
      </div>
    </>
  );
}
