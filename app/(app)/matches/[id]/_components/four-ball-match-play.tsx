import { displayName, getInitials } from "@/lib/players/player-name";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  MatchPlayCardRow,
  MatchPlayRules,
  MatchPlaySection,
  MatchPlayTable,
  type MatchPlayTeamCardProps,
  type MatchPlayTeamView,
  toMatchPlayView,
} from "./match-play-shared";

export function FourBallMatchPlayContent({
  teams,
}: {
  teams: MatchPlayTeamView[];
}) {
  const matchPlay = toMatchPlayView(teams, "four_ball_match_play");

  return (
    <>
      <MatchPlayRules>
        Four-ball match play compares each team&apos;s best net score hole by
        hole. The lowest-handicap player gets no strokes. Other players get 90%
        of their handicap difference, applied one stroke at a time on the
        hardest handicap holes.
      </MatchPlayRules>
      <MatchPlaySection title="Four-Ball">
        <MatchPlayCardRow
          matchPlay={matchPlay}
          renderTeamCard={(props) => (
            <FourBallTeamCard key={props.team.id} {...props} />
          )}
        />
      </MatchPlaySection>
      <MatchPlayTable holes={matchPlay.holes} teams={matchPlay.teams} />
    </>
  );
}

function FourBallTeamCard({
  team,
  label,
  secondary,
  primaryValue,
  primaryLabel,
  tone,
}: MatchPlayTeamCardProps) {
  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="flex min-h-20 items-center gap-3 px-0">
        <FourBallTeamAvatarPair team={team} />
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div className="truncate font-medium text-base">{label}</div>
          <div className="truncate text-sm text-muted-foreground leading-snug">
            {secondary}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end justify-center pr-3 leading-none">
          <span
            className={cn(
              "text-base tabular-nums",
              tone === "winning" &&
                "font-medium text-emerald-600 dark:text-emerald-500",
              tone === "losing" && "font-medium text-red-600 dark:text-red-500",
            )}
          >
            {primaryValue}
          </span>
          {primaryLabel ? (
            <span className="text-sm text-muted-foreground">
              {primaryLabel}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function FourBallTeamAvatarPair({ team }: { team: MatchPlayTeamView }) {
  return (
    <div className="flex h-20 shrink-0">
      {team.rounds.slice(0, 2).map((round, i, arr) => {
        const name = displayName({ ...round, email: null });
        const isFirst = i === 0;
        const isLast = i === arr.length - 1;
        return (
          <div
            key={round.id}
            className={cn(
              "size-20 overflow-hidden",
              isFirst && "rounded-tl-xl rounded-bl-xl",
              isLast && "rounded-tr-xl rounded-br-xl",
            )}
          >
            <Avatar className="size-full rounded-none after:hidden">
              {round.image ? (
                <AvatarImage
                  src={round.image}
                  alt={name}
                  className="rounded-none"
                />
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
