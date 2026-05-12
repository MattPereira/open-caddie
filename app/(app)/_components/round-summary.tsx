import { CourseHero } from "@/components/course-hero";
import {
  RoundScoresCard,
  type RoundScoresTableRound,
} from "@/components/round-scores-card";
import { toRoundScoreRow } from "@/components/round-scores-card-row";
import { StatTile } from "@/components/stat-tile";
import { formatDate } from "@/lib/utils";

const scoreTypeLabels = {
  eagles: "Eagles",
  birdies: "Birdies",
  pars: "Pars",
  bogeys: "Bogeys",
  doubles: "Doubles",
  triples: "Triples",
  quads: "Quads",
} as const;

type ScoreType = keyof typeof scoreTypeLabels;

export function RoundSummary({
  round,
  courseImgUrl,
  date,
  showMobileTotals = true,
}: {
  round: RoundScoresTableRound;
  courseImgUrl: string | null;
  date: Date | string;
  showMobileTotals?: boolean;
}) {
  const scoreTypeCounts = getScoreTypeCounts(round);
  const visibleScoreTypes = Object.entries(scoreTypeCounts).filter(
    ([, count]) => count > 0,
  ) as [ScoreType, number][];
  const visiblePuttGroups = getPuttGroups(round);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-5">
        <CourseHero
          courseName={round.courseName ?? null}
          courseImgUrl={courseImgUrl}
          subtitle={formatDate(date, "long")}
        />
        <RoundScoresCard
          row={toRoundScoreRow(round)}
          showMobileTotals={showMobileTotals}
        />
      </div>

      {visibleScoreTypes.length > 0 ? (
        <div className="grid grid-cols-4 gap-2">
          {visibleScoreTypes.map(([scoreType, count]) => (
            <StatTile
              key={scoreType}
              label={scoreTypeLabels[scoreType]}
              value={count}
            />
          ))}
        </div>
      ) : null}
      {visiblePuttGroups.length > 0 ? (
        <div className="grid grid-cols-4 gap-2">
          {visiblePuttGroups.map(({ putts, count }) => (
            <StatTile
              key={putts}
              label={`${putts} Putts`}
              value={count}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function getScoreTypeCounts(round: RoundScoresTableRound) {
  return round.scores.reduce<Record<ScoreType, number>>(
    (counts, score) => {
      if (score.strokes == null || score.par == null) return counts;

      const scoreToPar = score.strokes - score.par;

      if (scoreToPar <= -2) counts.eagles += 1;
      if (scoreToPar === -1) counts.birdies += 1;
      if (scoreToPar === 0) counts.pars += 1;
      if (scoreToPar === 1) counts.bogeys += 1;
      if (scoreToPar === 2) counts.doubles += 1;
      if (scoreToPar === 3) counts.triples += 1;
      if (scoreToPar >= 4) counts.quads += 1;

      return counts;
    },
    {
      eagles: 0,
      birdies: 0,
      pars: 0,
      bogeys: 0,
      doubles: 0,
      triples: 0,
      quads: 0,
    },
  );
}

function getPuttGroups(round: RoundScoresTableRound) {
  const puttCounts = round.scores.reduce<Map<number, number>>(
    (counts, score) => {
      if (score.putts == null) return counts;
      counts.set(score.putts, (counts.get(score.putts) ?? 0) + 1);
      return counts;
    },
    new Map(),
  );

  return Array.from(puttCounts, ([putts, count]) => ({ putts, count })).sort(
    (a, b) => a.putts - b.putts,
  );
}
