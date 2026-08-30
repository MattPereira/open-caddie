"use client";

import { useMemo, useState, useTransition } from "react";

import type { ReactNode } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  deleteRoundGreenie,
  upsertRoundGreenie,
  upsertRoundScore,
} from "../../../actions";
import type { RoundScoresTableRound } from "@/components/features/scores/round-scores-card";
import {
  type ScoreEntry,
  buildInitialScores,
  buildLiveRound,
  isRoundComplete,
} from "./round-score-state";
import type { GreenieValue } from "./hole-greenie-manager";
import { HoleScoreRow } from "./hole-score-row";
import { ScoreEntrySheet, type ScorePatch } from "./score-entry-sheet";
import { SettingsDialog, type SettingsTee } from "./settings-dialog";
import { TournamentLeaderboardDialog } from "./tournament-leaderboard-dialog";
import { MatchScoreboardDialog } from "./match-scoreboard-dialog";
import { selfColumnClassName } from "./self-column";
import {
  type GreenieEntry,
  useLiveScorecard,
} from "./use-live-scorecard";
import { useRefreshOnWake } from "./use-refresh-on-wake";
import type { MatchScoreboard, ScoringPeer } from "./round-play";

export type { SettingsTee };

type Nine = "out" | "in";

// The default active state (near-white on light grey) is too quiet to read at a
// glance in sunlight, so the selected nine gets a filled primary chip.
const nineTabClassName =
  "text-base data-active:bg-primary data-active:text-primary-foreground dark:data-active:border-transparent dark:data-active:bg-primary dark:data-active:text-primary-foreground";

type RoundScoresFormProps = {
  roundId: number;
  // Whose column gets marked. Read from the session rather than the Round,
  // because an admin may be keeping a card that is not their own — in which
  // case no column is theirs.
  currentUserId: string;
  // The server's snapshot of this Round, not what the card is showing: the
  // cells are that snapshot merged with whatever this device has typed and the
  // server has yet to confirm.
  round: RoundScoresTableRound;
  leaderboardRounds?: RoundScoresTableRound[];
  holes: {
    hole: number;
    par: number;
    handicap?: number | null;
    yards: number | null;
  }[];
  tees: SettingsTee[];
  scoringPeers: ScoringPeer[];
  matchScoreboard: MatchScoreboard | null;
  delegateRoundIds: readonly number[];
  setDelegateRoundIdsAction: (next: readonly number[]) => void;
  onShowSummaryAction: () => void;
  summaryLabel: string;
};

export function RoundScoresForm({
  roundId,
  currentUserId,
  round: serverRound,
  leaderboardRounds,
  holes,
  tees,
  scoringPeers,
  matchScoreboard,
  delegateRoundIds,
  setDelegateRoundIdsAction,
  onShowSummaryAction,
  summaryLabel,
}: RoundScoresFormProps) {
  const [recordPutts, setRecordPutts] = useState(true);
  const [recordGreenies, setRecordGreenies] = useState(true);
  const delegatePlayers = useMemo(
    () =>
      delegateRoundIds
        .map((id) => scoringPeers.find((p) => p.roundId === id))
        .filter((p): p is ScoringPeer => p != null),
    [delegateRoundIds, scoringPeers],
  );
  const getPlayerName = (player: ScoringPeer) => player.firstName || "Player";
  // The grid columns are too narrow for anything but a first name, so the full
  // name is carried separately for the roomier score entry sheet.
  const getFullName = (
    player: { firstName: string | null; lastName: string | null },
    fallback: string,
  ) =>
    [player.firstName, player.lastName].filter(Boolean).join(" ") || fallback;
  // All peers stay in the snapshot even while deselected. Selection then only
  // controls visible columns; it cannot interrupt refresh reconciliation.
  const baseScoresByRoundId = useMemo(() => {
    const map: Record<number, ScoreEntry[]> = {
      [roundId]: buildInitialScores(serverRound.scores, holes),
    };
    for (const player of scoringPeers) {
      map[player.roundId] = buildInitialScores(player.scores, holes);
    }
    return map;
  }, [roundId, serverRound.scores, holes, scoringPeers]);
  const baseGreeniesByRoundId = useMemo(() => {
    const map: Record<number, GreenieEntry[]> = {
      [roundId]: serverRound.greenies ?? [],
    };
    for (const player of scoringPeers) {
      map[player.roundId] = player.greenies ?? [];
    }
    return map;
  }, [roundId, serverRound.greenies, scoringPeers]);

  const {
    scoresByRoundId,
    greeniesByRoundId,
    editScore,
    editGreenie,
    prepareForRefresh,
  } = useLiveScorecard(
    baseScoresByRoundId,
    baseGreeniesByRoundId,
  );
  // The card is read again every time the phone comes back on screen. The live
  // state keeps pending writes, then retires accepted ones into that snapshot.
  useRefreshOnWake(prepareForRefresh);
  // This Round is always in the base map, so the merge always returns it — and
  // a stable identity here is what keeps the live Round below from rebuilding.
  const scores = scoresByRoundId[roundId];
  const round = useMemo(
    () => buildLiveRound(serverRound, scores),
    [serverRound, scores],
  );
  const selfName = round.firstName ?? "You";

  const [saveError, setSaveError] = useState<string | null>(null);
  const [, startSaveTransition] = useTransition();
  const [activeCell, setActiveCell] = useState<{
    roundId: number;
    hole: number;
  } | null>(null);

  // Derived rather than held: clearing a score should hand the marker back to
  // that hole, so the card always points at the first one still unplayed.
  const highlightHole =
    scores.find((entry) => entry.strokes == null)?.hole ?? null;
  // Resume on the nine holding the first unplayed hole.
  const [activeNine, setActiveNine] = useState<Nine>(() =>
    highlightHole != null && highlightHole > 9 ? "in" : "out",
  );

  const isComplete = isRoundComplete(round);
  const backLink =
    round.tournamentId != null
      ? { href: `/tournaments/${round.tournamentId}`, label: "Tournament" }
      : round.matchId != null
        ? { href: `/matches/${round.matchId}`, label: "Match" }
        : null;

  const getGreeniesForRound = (targetRoundId: number): GreenieEntry[] =>
    greeniesByRoundId[targetRoundId] ?? [];

  const saveScore = (
    targetRoundId: number,
    hole: number,
    patch: ScorePatch,
  ) => {
    setSaveError(null);
    const edit = editScore(targetRoundId, hole, patch);
    if (targetRoundId === roundId) {
      const next = scores.map((s) =>
        s.hole === hole ? { ...s, ...patch } : s,
      );
      const frontComplete = next
        .filter((s) => s.hole <= 9)
        .every((s) => s.strokes != null);
      // Only on the first pass — otherwise editing an old front-nine hole late
      // in the round would yank you off the tab you chose.
      const backUnstarted = next
        .filter((s) => s.hole > 9)
        .every((s) => s.strokes == null);
      if (frontComplete && backUnstarted) setActiveNine("in");
    }
    startSaveTransition(async () => {
      const result = await upsertRoundScore({
        roundId: targetRoundId,
        hole,
        ...patch,
      });
      if (result.ok) {
        edit.accept();
      } else if (edit.reject()) {
        setSaveError(result.error);
      }
    });
  };

  const saveGreenie = (
    targetRoundId: number,
    hole: number,
    value: GreenieValue,
  ) => {
    setSaveError(null);
    const edit = editGreenie(targetRoundId, hole, value);
    startSaveTransition(async () => {
      const result = await upsertRoundGreenie({
        roundId: targetRoundId,
        hole,
        ...value,
      });
      if (result.ok) {
        edit.accept();
      } else if (edit.reject()) {
        setSaveError(result.error);
      }
    });
  };

  const removeGreenie = (targetRoundId: number, hole: number) => {
    setSaveError(null);
    const edit = editGreenie(targetRoundId, hole, null);
    startSaveTransition(async () => {
      const result = await deleteRoundGreenie({
        roundId: targetRoundId,
        hole,
      });
      if (result.ok) {
        edit.accept();
      } else if (edit.reject()) {
        setSaveError(result.error);
      }
    });
  };

  const liveMatchScoreboard = useMemo(() => {
    if (!matchScoreboard) return null;
    const rounds = matchScoreboard.rounds.map((scoreboardRound) => {
      if (scoreboardRound.id === round.id) {
        return round;
      }
      const delegateScores = scoresByRoundId[scoreboardRound.id];
      if (delegateScores) {
        return applyScoreEntriesToRound(scoreboardRound, delegateScores);
      }
      return scoreboardRound;
    });
    const roundsById = new Map(
      rounds.map((scoreboardRound) => [scoreboardRound.id, scoreboardRound]),
    );

    return {
      ...matchScoreboard,
      rounds,
      teams: matchScoreboard.teams.map((team) => ({
        ...team,
        rounds: team.rounds.map(
          (teamRound) => roundsById.get(teamRound.id) ?? teamRound,
        ),
      })),
    };
  }, [scoresByRoundId, matchScoreboard, round]);

  const players = [
    {
      roundId,
      name: selfName,
      fullName: getFullName(round, selfName),
      isSelf: round.userId === currentUserId,
      scores,
    },
    ...delegatePlayers.map((player) => ({
      roundId: player.roundId,
      name: getPlayerName(player),
      fullName: getFullName(player, getPlayerName(player)),
      isSelf: player.userId === currentUserId,
      scores: scoresByRoundId[player.roundId] ?? [],
    })),
  ];
  // Score columns keep a fixed width so cells stay the same size whoever you are
  // scoring for; the table is centered until enough players push it full width.
  const columns = `2.75rem 2.75rem 3.5rem repeat(${players.length}, minmax(3.25rem,4.5rem))`;

  const activePlayer =
    activeCell == null
      ? null
      : (players.find((player) => player.roundId === activeCell.roundId) ??
        null);
  const activeEntry =
    activeCell == null || activePlayer == null
      ? null
      : (activePlayer.scores.find((entry) => entry.hole === activeCell.hole) ??
        null);
  const activePar =
    activeEntry?.par ??
    holes.find((hole) => hole.hole === activeCell?.hole)?.par ??
    4;
  const activeGreenie =
    activeCell == null
      ? null
      : (getGreeniesForRound(activeCell.roundId).find(
          (greenie) => greenie.hole === activeCell.hole,
        ) ?? null);

  // Only one nine is on screen at a time, so all 18 holes stay reachable in a
  // single tap instead of a ~560px scroll.
  const renderNine = (nine: Nine) => {
    const [from, to] = nine === "out" ? [1, 9] : [10, 18];

    return (
      <div className="mx-auto flex w-fit max-w-full flex-col gap-1.5">
        <p className="truncate text-base text-muted-foreground">
          {round.courseName}
        </p>
        <div className="overflow-hidden rounded-lg ring-1 ring-border">
          <div
            style={{ gridTemplateColumns: columns }}
            className="grid items-center bg-muted"
          >
            <HeaderCell className="text-center">HOL</HeaderCell>
            <HeaderCell className="text-center">PAR</HeaderCell>
            <HeaderCell className="text-center">YDS</HeaderCell>
            {players.map((player) => (
              <HeaderCell
                key={player.roundId}
                className={cn(
                  "self-stretch border-l border-border text-center",
                  player.isSelf &&
                    cn(selfColumnClassName, "font-semibold text-foreground"),
                )}
              >
                {toInitials(player.fullName)}
              </HeaderCell>
            ))}
          </div>

          {scores
            .filter((entry) => entry.hole >= from && entry.hole <= to)
            .map((entry) => (
              <HoleScoreRow
                key={entry.hole}
                hole={entry.hole}
                par={entry.par}
                yards={entry.yards}
                showPutts={recordPutts}
                highlight={entry.hole === highlightHole}
                columns={columns}
                cells={players.map((player) => {
                  const playerEntry = player.scores.find(
                    (playerScore) => playerScore.hole === entry.hole,
                  );
                  return {
                    id: player.roundId,
                    playerName: player.name,
                    isSelf: player.isSelf,
                    strokes: playerEntry?.strokes ?? null,
                    putts: playerEntry?.putts ?? null,
                  };
                })}
                onSelectAction={(targetRoundId) =>
                  setActiveCell({ roundId: targetRoundId, hole: entry.hole })
                }
              />
            ))}

          <SummaryRow
            label={nine === "out" ? "Out" : "In"}
            labelColumns={3}
            columns={columns}
            showPutts={recordPutts}
            players={players}
            from={from}
            to={to}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
      <Tabs
        className="flex-1"
        value={activeNine}
        onValueChange={(value) => setActiveNine(value as Nine)}
      >
        <div className="flex items-center justify-between gap-3">
          <h1 className="sr-only">
            {`${round.courseName ?? "Round"} scorecard`}
          </h1>
          {/* The card itself says whose it is — the tinted column and the
              column headers — so the heading slot is spent on the way out
              instead. A Round with no parent gets no link, and the tabs sit
              alone on the right. */}
          {backLink ? (
            <Button asChild variant="secondary" size="xl" className="min-w-0">
              <Link href={backLink.href}>
                <HugeiconsIcon
                  icon={ArrowLeft02Icon}
                  data-icon="inline-start"
                />
                {backLink.label}
              </Link>
            </Button>
          ) : null}
          {/* TabsList sets its height as group-data-horizontal/tabs:h-8, so a
              bare h-* here survives the class merge but loses on specificity.
              The override has to carry the same modifier to take effect. */}
          <TabsList className="ml-auto w-36 shrink-0 group-data-horizontal/tabs:h-12">
            <TabsTrigger value="out" className={nineTabClassName}>
              Out
            </TabsTrigger>
            <TabsTrigger value="in" className={nineTabClassName}>
              In
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="out" className="flex flex-col justify-center">
          {renderNine("out")}
        </TabsContent>
        <TabsContent value="in" className="flex flex-col justify-center">
          {renderNine("in")}
        </TabsContent>
      </Tabs>

      {saveError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {saveError}
        </p>
      ) : null}

      <div className="sticky bottom-0 z-10 mt-auto flex items-center gap-2 bg-background py-3">
        {isComplete ? (
          <Button
            type="button"
            size="xl"
            className="w-full"
            onClick={onShowSummaryAction}
          >
            {summaryLabel}
          </Button>
        ) : (
          <>
            <SettingsDialog
              roundId={roundId}
              round={round}
              tees={tees}
              scoringPeers={scoringPeers}
              delegateRoundIds={delegateRoundIds}
              setDelegateRoundIdsAction={setDelegateRoundIdsAction}
              recordPutts={recordPutts}
              setRecordPuttsAction={setRecordPutts}
              recordGreenies={recordGreenies}
              setRecordGreeniesAction={setRecordGreenies}
              fullWidth={round.tournamentId == null && round.matchId == null}
            />
            {round.tournamentId != null ? (
              <TournamentLeaderboardDialog
                currentRound={round}
                leaderboardRounds={leaderboardRounds}
              />
            ) : round.matchId != null ? (
              <MatchScoreboardDialog scoreboard={liveMatchScoreboard} />
            ) : null}
          </>
        )}
      </div>

      {activeCell != null && activePlayer != null ? (
        <ScoreEntrySheet
          open
          hole={activeCell.hole}
          par={activePar}
          playerName={activePlayer.fullName}
          strokes={activeEntry?.strokes ?? null}
          putts={activeEntry?.putts ?? null}
          greenie={
            activeGreenie
              ? { feet: activeGreenie.feet, inches: activeGreenie.inches }
              : null
          }
          showPutts={recordPutts}
          showGreenie={recordGreenies && activePar === 3}
          onOpenChangeAction={(open) => {
            if (!open) setActiveCell(null);
          }}
          onSubmitAction={(patch) =>
            saveScore(activeCell.roundId, activeCell.hole, patch)
          }
          onGreenieSaveAction={(value) =>
            saveGreenie(activeCell.roundId, activeCell.hole, value)
          }
          onGreenieDeleteAction={() =>
            removeGreenie(activeCell.roundId, activeCell.hole)
          }
        />
      ) : null}
    </div>
  );
}

function SummaryRow({
  label,
  labelColumns,
  columns,
  showPutts,
  players,
  from,
  to,
}: {
  label: string;
  labelColumns: number;
  columns: string;
  showPutts: boolean;
  players: { roundId: number; isSelf: boolean; scores: ScoreEntry[] }[];
  from: number;
  to: number;
}) {
  return (
    <div
      style={{ gridTemplateColumns: columns }}
      className="grid items-center border-t border-border bg-muted"
    >
      <div
        style={{ gridColumn: `span ${labelColumns}` }}
        className="px-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </div>
      {players.map((player) => {
        const strokes = sumRange(player.scores, from, to, "strokes");
        const putts = sumRange(player.scores, from, to, "putts");
        return (
          <div
            key={player.roundId}
            className={cn(
              "relative flex h-11 items-center justify-center border-l border-border text-base font-semibold tabular-nums",
              player.isSelf && selfColumnClassName,
            )}
          >
            {strokes ?? "—"}
            {showPutts && putts != null ? (
              <span className="absolute right-1 top-0.5 text-xs font-normal text-muted-foreground">
                {putts}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function HeaderCell({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "py-2 text-sm font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

function sumRange(
  entries: ScoreEntry[],
  from: number,
  to: number,
  key: "strokes" | "putts",
) {
  const values = entries
    .filter((entry) => entry.hole >= from && entry.hole <= to)
    .map((entry) => entry[key])
    .filter((value): value is number => value != null);
  return values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0);
}

function toInitials(name: string) {
  return name
    .split(" ")
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function applyScoreEntriesToRound(
  round: RoundScoresTableRound,
  scores: ScoreEntry[],
): RoundScoresTableRound {
  const recordedScores = scores.filter((score) => score.strokes != null);
  const recordedPutts = scores.filter((score) => score.putts != null);

  return {
    ...round,
    recordedStrokesCount: recordedScores.length,
    recordedPuttsCount: recordedPutts.length,
    totalStrokes: recordedScores.reduce(
      (total, score) => total + (score.strokes ?? 0),
      0,
    ),
    totalPutts: recordedPutts.reduce(
      (total, score) => total + (score.putts ?? 0),
      0,
    ),
    scores: scores.map((score) => ({
      hole: score.hole,
      par: score.par,
      strokes: score.strokes,
      putts: score.putts,
    })),
  };
}
