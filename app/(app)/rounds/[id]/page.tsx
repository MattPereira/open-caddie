import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CourseCard } from "@/components/course-card";
import { GreenieCard } from "@/components/greenie-card";
import { InfoAlert } from "@/components/info-alert";
import { displayName } from "@/components/player-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getRoundById } from "@/db/queries/rounds";
import { formatDate } from "@/lib/utils";
import { RoundScoresTable } from "../../tournaments/[id]/_components/round-scores-table";

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
  const round = await getRoundFromParams(params);

  if (!round) notFound();

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-normal">
          Round Details
        </h1>
        <div className="text-sm text-muted-foreground">
          <span>{formatDate(round.date, "long")}</span>
        </div>
        {round.tournamentId ? (
          <Link
            href={`/tournaments/${round.tournamentId}`}
            className="flex w-fit flex-wrap items-center gap-2 pt-1"
          >
            <Badge variant="outline">Tournament</Badge>
            {round.clubName ? (
              <Badge variant="secondary">{round.clubName}</Badge>
            ) : null}
            {round.tournamentSeason == null ? null : (
              <Badge variant="secondary">Season {round.tournamentSeason}</Badge>
            )}
          </Link>
        ) : null}
      </div>

      <section className="flex min-w-0 flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-normal">Course</h2>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <CourseCard
            course={{
              name: round.courseName,
              rating: round.courseRating,
              slope: round.courseSlope,
              imgUrl: round.courseImgUrl,
            }}
            href={`/courses/${encodeURIComponent(round.courseHandle)}`}
          />
        </div>
      </section>

      <section className="flex min-w-0 flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-normal">Scores</h2>
        <RoundScoresTable rounds={[round]} />
      </section>

      <section className="flex min-w-0 flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-normal">Greenies</h2>
        {round.greenies.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No greenies have been recorded for this round.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3 2xl:grid-cols-3">
            {round.greenies.map((greenie) => (
              <GreenieCard
                key={`${greenie.roundId}-${greenie.hole}`}
                greenie={greenie}
              />
            ))}
          </div>
        )}
      </section>

      {round.handicap ? <HandicapSection round={round} /> : null}
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

function HandicapSection({ round }: { round: Round }) {
  const handicap = round.handicap;

  if (!handicap) return null;

  const hasEnoughPriorRounds = handicap.priorRounds.length >= 2;

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <h2 className="text-xl font-semibold tracking-normal">Handicap</h2>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="grid w-full max-w-lg grid-cols-2 gap-2">
            <HandicapStat
              label="Handicap"
              value={formatNullableDecimal(handicap.tournamentHandicap)}
            />
            <HandicapStat
              label="Index"
              value={formatNullableDecimal(handicap.playerIndex)}
            />
          </div>

          {handicap.priorRounds.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No eligible prior club tournament rounds were found.
            </p>
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
        </CardContent>
      </Card>
    </section>
  );
}

type PriorHandicapRound =
  NonNullable<Round["handicap"]> extends {
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
          <HandicapRoundStat label="Rating" value={priorRound.courseRating} />
          <HandicapRoundStat label="Slope" value={priorRound.courseSlope} />
          <HandicapRoundStat label="Strokes" value={priorRound.totalStrokes} />
          <HandicapRoundStat
            label="Diff"
            value={formatDecimal(priorRound.scoreDifferential)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function HandicapRoundStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-md bg-muted px-2 py-1.5">
      <span className="truncate text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <span className="text-right text-sm font-semibold tabular-nums">
        {value}
      </span>
    </div>
  );
}

function HandicapStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md bg-muted px-3 py-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function formatNullableDecimal(value: number | null) {
  return value == null ? "-" : formatDecimal(value);
}

function formatDecimal(value: number) {
  return value.toFixed(1);
}
