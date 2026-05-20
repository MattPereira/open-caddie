import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PlayCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { CourseHero } from "@/components/course-hero";
import { GreenieCard } from "@/components/greenie-card";
import { displayName } from "@/components/player-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getRoundById } from "@/db/queries/rounds";
import { getCurrentUser } from "@/db/queries/users";
import { formatDate } from "@/lib/utils";
import { RoundActions } from "./_components/round-actions";
import { StatTile } from "@/components/stat-tile";
import { RoundScoresCard } from "@/components/round-scores-card";
import { toRoundScoreRow } from "@/components/round-scores-card-row";

type RoundPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: RoundPageProps): Promise<Metadata> {
  const round = await getRoundFromParams(params);
  const playerName = round ? displayName({ ...round, email: null }) : null;

  return {
    title: playerName ? `${playerName} Round` : "Round",
  };
}

export default async function RoundPage({ params }: RoundPageProps) {
  const [round, currentUser] = await Promise.all([
    getRoundFromParams(params),
    getCurrentUser(),
  ]);

  if (!round) notFound();
  const canEdit = currentUser?.isAdmin || currentUser?.id === round.userId;
  const hasAllScores =
    round.holes.length > 0 &&
    round.holes.every((hole) => {
      const score = round.scores.find((s) => s.hole === hole.hole);
      return score?.strokes != null && score?.putts != null;
    });

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <h1 className="text-2xl font-semibold tracking-normal">
            {round.courseName}
          </h1>
          {round.clubName ? (
            <Badge variant="outline" className="font-light">
              {round.clubName}
            </Badge>
          ) : null}
          {round.tournamentId && round.tournamentSeason ? (
            <Badge variant="outline" className="font-light">
              Season {round.tournamentSeason}
            </Badge>
          ) : null}
        </div>
        <CourseHero
          courseName={round.courseName}
          courseImgUrl={round.courseImgUrl}
          subtitle={formatDate(round.date, "long")}
        />
        {canEdit && !hasAllScores ? (
          <Button asChild size="xl" className="w-full">
            <Link href={`/rounds/${round.id}/play`}>
              <HugeiconsIcon icon={PlayCircleIcon} data-icon="inline-start" />
              Play round
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-normal">Scores</h2>
            {canEdit ? <RoundActions round={round} /> : null}
          </div>
          <RoundScoresCard row={toRoundScoreRow(round)} showMobileTotals />
        </section>

        <section className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-normal">Greenies</h2>
            {canEdit ? (
              <RoundActions initialTab="greenies" round={round} />
            ) : null}
          </div>
          {round.greenies.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  No greenies have been recorded for this round.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex w-full flex-col gap-3">
              {round.greenies.map((greenie) => (
                <GreenieCard
                  key={`${greenie.roundId}-${greenie.hole}`}
                  greenie={greenie}
                  courseName={greenie.courseName}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {round.tournamentHandicapDetails ? (
        <TournamentHandicapSection round={round} />
      ) : null}
    </main>
  );
}

async function getRoundFromParams(params: RoundPageProps["params"]) {
  const { id } = await params;
  const roundId = Number(id);

  if (!Number.isInteger(roundId) || roundId <= 0) {
    return null;
  }

  return getRoundById(roundId);
}

type Round = NonNullable<Awaited<ReturnType<typeof getRoundById>>>;

function TournamentHandicapSection({ round }: { round: Round }) {
  const handicap = round.tournamentHandicapDetails;

  if (!handicap) return null;

  const hasEnoughPriorRounds = handicap.priorRounds.length >= 2;

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-normal">Handicap</h2>

      {handicap.priorRounds.length === 0 ? (
        <Card size="sm">
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              No eligible prior club tournament rounds were found.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
          {handicap.priorRounds.map((priorRound) => (
            <PriorHandicapRoundCard
              key={priorRound.id}
              priorRound={priorRound}
            />
          ))}
        </div>
      )}

      {!hasEnoughPriorRounds ? (
        <p className="text-sm text-muted-foreground">
          At least 2 eligible prior rounds are needed to calculate a player
          index.
        </p>
      ) : null}
    </section>
  );
}

type PriorHandicapRound =
  NonNullable<Round["tournamentHandicapDetails"]> extends {
    priorRounds: (infer PriorRound)[];
  }
    ? PriorRound
    : never;

function PriorHandicapRoundCard({
  priorRound,
}: {
  priorRound: PriorHandicapRound;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <Link
              href={`/courses/${encodeURIComponent(priorRound.courseHandle)}`}
              className="truncate font-medium underline-offset-4 hover:underline"
            >
              {priorRound.courseName}
            </Link>
            <span className="text-xs text-muted-foreground">
              {formatDate(priorRound.date, "standard")}
            </span>
          </div>
          {priorRound.usedForPlayerIndex ? <Badge>Used</Badge> : null}
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          <StatTile label="Rtg" value={priorRound.courseRating} />
          <StatTile label="Slp" value={priorRound.courseSlope} />
          <StatTile label="Str" value={priorRound.totalStrokes} />
          <StatTile
            label="Diff"
            value={formatDecimal(priorRound.scoreDifferential)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function formatDecimal(value: number) {
  return value.toFixed(1);
}
