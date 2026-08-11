"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatScore,
  type RoundScoresTableRound,
} from "@/components/features/scores/round-scores-card";
import { toRoundScoreRow } from "@/components/features/scores/round-scores";

export function TournamentLeaderboardDialog({
  currentRound,
  leaderboardRounds,
}: {
  currentRound: RoundScoresTableRound;
  leaderboardRounds?: RoundScoresTableRound[];
}) {
  if (currentRound.tournamentId == null || !leaderboardRounds?.length) {
    return null;
  }

  const leaderboardRows = leaderboardRounds
    .map((leaderboardRound) =>
      toLeaderboardRow(
        leaderboardRound.id === currentRound.id
          ? currentRound
          : leaderboardRound,
      ),
    )
    .sort(compareLeaderboardRows);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" className="flex-1" size="xl">
          Scoreboard
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100%-1.5rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tournament leaderboard</DialogTitle>
          <DialogDescription>
            Live totals from the scores entered so far.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-lg ring-1 ring-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Player</TableHead>
                <TableHead className="w-16 text-center">Thru</TableHead>
                <TableHead className="w-16 text-right">Str</TableHead>
                <TableHead className="w-16 text-right">Putts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboardRows.map((leaderboardRow) => (
                <TableRow
                  key={leaderboardRow.roundId}
                  data-state={
                    leaderboardRow.roundId === currentRound.id
                      ? "selected"
                      : undefined
                  }
                >
                  <TableCell className="max-w-36 truncate font-medium">
                    {leaderboardRow.playerName}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {formatScore(leaderboardRow.lastHole)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatScore(leaderboardRow.strokes)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatScore(leaderboardRow.putts)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type TournamentLeaderboardRow = {
  roundId: number;
  playerName: string;
  lastHole: number | null;
  strokes: number | null;
  putts: number | null;
};

function toLeaderboardRow(
  round: RoundScoresTableRound,
): TournamentLeaderboardRow {
  const row = toRoundScoreRow(round);

  return {
    roundId: round.id,
    playerName: row.playerName,
    lastHole: getLastScoredHole(round),
    strokes: row.metrics.strokes.total,
    putts: row.metrics.putts.total,
  };
}

function getLastScoredHole(round: RoundScoresTableRound) {
  return round.scores.reduce<number | null>((lastHole, score) => {
    if (score.strokes == null && score.putts == null) return lastHole;
    return Math.max(lastHole ?? 0, score.hole);
  }, null);
}

function compareLeaderboardRows(
  a: TournamentLeaderboardRow,
  b: TournamentLeaderboardRow,
) {
  const strokesCompare = compareNullableNumbers(a.strokes, b.strokes);
  if (strokesCompare !== 0) return strokesCompare;

  const lastHoleCompare = compareNullableNumbersDescending(
    a.lastHole,
    b.lastHole,
  );
  if (lastHoleCompare !== 0) return lastHoleCompare;

  return a.playerName.localeCompare(b.playerName);
}

function compareNullableNumbers(a: number | null, b: number | null) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

function compareNullableNumbersDescending(a: number | null, b: number | null) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return b - a;
}
