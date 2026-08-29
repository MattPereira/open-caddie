"use client";

import { useCallback, useMemo, useReducer, useRef } from "react";

import type { GreenieValue } from "./hole-greenie-manager";
import type { ScoreEntry } from "./round-score-state";
import type { ScorePatch } from "./score-entry-sheet";

export type GreenieEntry = GreenieValue & { hole: number };

type EditValue =
  | { kind: "score"; value: ScorePatch }
  | { kind: "greenie"; value: GreenieValue | null };

type LocalEdit = EditValue & {
  version: number;
  status: "pending" | "accepted";
  retireOnSnapshot: boolean;
};

type LiveScorecardState = {
  scoreBase: Record<number, ScoreEntry[]>;
  greenieBase: Record<number, GreenieEntry[]>;
  edits: Record<string, Record<number, LocalEdit>>;
};

type EditIdentity = {
  kind: EditValue["kind"];
  roundId: number;
  hole: number;
  version: number;
};

type LiveScorecardEvent =
  | {
      type: "snapshot";
      scoreBase: Record<number, ScoreEntry[]>;
      greenieBase: Record<number, GreenieEntry[]>;
    }
  | { type: "refresh-started" }
  | ({ type: "edit-applied"; edit: LocalEdit } &
      Omit<EditIdentity, "kind" | "version">)
  | ({ type: "edit-accepted" | "edit-rejected" } & EditIdentity);

type EditResolution = {
  accept: () => void;
  reject: () => boolean;
};

const cellKey = (kind: EditValue["kind"], roundId: number, hole: number) =>
  `${kind}:${roundId}:${hole}`;

function updateCell(
  edits: LiveScorecardState["edits"],
  key: string,
  update: (versions: Record<number, LocalEdit>) => Record<number, LocalEdit>,
) {
  const next = { ...edits };
  const versions = update(edits[key] ?? {});
  if (Object.keys(versions).length === 0) delete next[key];
  else next[key] = versions;
  return next;
}

function mapEdits(
  edits: LiveScorecardState["edits"],
  update: (edit: LocalEdit) => LocalEdit | null,
) {
  const next: LiveScorecardState["edits"] = {};
  for (const [key, versions] of Object.entries(edits)) {
    const nextVersions: Record<number, LocalEdit> = {};
    for (const [versionKey, edit] of Object.entries(versions)) {
      const nextEdit = update(edit);
      if (nextEdit) nextVersions[Number(versionKey)] = nextEdit;
    }
    if (Object.keys(nextVersions).length > 0) next[key] = nextVersions;
  }
  return next;
}

export function reduceLiveScorecard(
  state: LiveScorecardState,
  event: LiveScorecardEvent,
): LiveScorecardState {
  switch (event.type) {
    case "snapshot":
      return {
        scoreBase: event.scoreBase,
        greenieBase: event.greenieBase,
        edits: mapEdits(state.edits, (edit) =>
          edit.retireOnSnapshot ? null : edit,
        ),
      };
    case "refresh-started":
      return {
        ...state,
        edits: mapEdits(state.edits, (edit) =>
          edit.status === "accepted"
            ? { ...edit, retireOnSnapshot: true }
            : edit,
        ),
      };
    case "edit-applied": {
      const key = cellKey(event.edit.kind, event.roundId, event.hole);
      return {
        ...state,
        edits: updateCell(state.edits, key, (versions) => ({
          ...versions,
          [event.edit.version]: event.edit,
        })),
      };
    }
    case "edit-accepted": {
      const key = cellKey(event.kind, event.roundId, event.hole);
      const edit = state.edits[key]?.[event.version];
      if (edit == null) return state;
      return {
        ...state,
        edits: updateCell(state.edits, key, (versions) => ({
          ...versions,
          [event.version]: {
            ...edit,
            status: "accepted",
            // Acceptance after refresh began belongs to the next snapshot.
            retireOnSnapshot: false,
          },
        })),
      };
    }
    case "edit-rejected": {
      const key = cellKey(event.kind, event.roundId, event.hole);
      if (state.edits[key]?.[event.version] == null) return state;
      return {
        ...state,
        edits: updateCell(state.edits, key, (versions) => {
          const next = { ...versions };
          delete next[event.version];
          return next;
        }),
      };
    }
  }
}

function visibleEdit(
  edits: LiveScorecardState["edits"],
  kind: EditValue["kind"],
  roundId: number,
  hole: number,
) {
  const versions = edits[cellKey(kind, roundId, hole)];
  if (versions == null) return undefined;
  return versions[Math.max(...Object.keys(versions).map(Number))];
}

export function readLiveScorecard(state: LiveScorecardState) {
  const scoresByRoundId: Record<number, ScoreEntry[]> = {};
  for (const [roundKey, base] of Object.entries(state.scoreBase)) {
    const roundId = Number(roundKey);
    scoresByRoundId[roundId] = base.map((entry) => {
      const edit = visibleEdit(state.edits, "score", roundId, entry.hole);
      return edit?.kind === "score" ? { ...entry, ...edit.value } : entry;
    });
  }

  const greeniesByRoundId: Record<number, GreenieEntry[]> = {};
  for (const [roundKey, base] of Object.entries(state.greenieBase)) {
    const roundId = Number(roundKey);
    const merged = base.filter(
      (greenie) =>
        visibleEdit(state.edits, "greenie", roundId, greenie.hole) == null,
    );
    for (let hole = 1; hole <= 18; hole += 1) {
      const edit = visibleEdit(state.edits, "greenie", roundId, hole);
      if (edit?.kind === "greenie" && edit.value != null) {
        merged.push({ hole, ...edit.value });
      }
    }
    greeniesByRoundId[roundId] = merged.sort((a, b) => a.hole - b.hole);
  }

  return { scoresByRoundId, greeniesByRoundId };
}

export function createLiveScorecardState(
  scoreBase: Record<number, ScoreEntry[]>,
  greenieBase: Record<number, GreenieEntry[]>,
): LiveScorecardState {
  return { scoreBase, greenieBase, edits: {} };
}

/**
 * Shows a server snapshot plus this device's local writes. Pending writes
 * survive every snapshot. Accepted writes retire into the first snapshot whose
 * refresh began after their save, whether another scorer agreed or overwrote it.
 */
export function useLiveScorecard(
  scoreBase: Record<number, ScoreEntry[]>,
  greenieBase: Record<number, GreenieEntry[]>,
) {
  const [state, dispatch] = useReducer(
    reduceLiveScorecard,
    createLiveScorecardState(scoreBase, greenieBase),
  );
  const versionRef = useRef(0);
  const latestVersionRef = useRef<Record<string, number>>({});

  if (state.scoreBase !== scoreBase || state.greenieBase !== greenieBase) {
    dispatch({ type: "snapshot", scoreBase, greenieBase });
  }

  const live = useMemo(() => readLiveScorecard(state), [state]);
  const prepareForRefresh = useCallback(
    () => dispatch({ type: "refresh-started" }),
    [],
  );

  const startEdit = (
    roundId: number,
    hole: number,
    edit: EditValue,
  ): EditResolution => {
    const version = ++versionRef.current;
    const key = cellKey(edit.kind, roundId, hole);
    latestVersionRef.current[key] = version;
    dispatch({
      type: "edit-applied",
      roundId,
      hole,
      edit: { ...edit, version, status: "pending", retireOnSnapshot: false },
    });
    return {
      accept: () =>
        dispatch({
          type: "edit-accepted",
          kind: edit.kind,
          roundId,
          hole,
          version,
        }),
      reject: () => {
        dispatch({
          type: "edit-rejected",
          kind: edit.kind,
          roundId,
          hole,
          version,
        });
        return latestVersionRef.current[key] === version;
      },
    };
  };

  const editScore = (roundId: number, hole: number, value: ScorePatch) =>
    startEdit(roundId, hole, { kind: "score", value });
  const editGreenie = (
    roundId: number,
    hole: number,
    value: GreenieValue | null,
  ) => startEdit(roundId, hole, { kind: "greenie", value });

  return { ...live, editScore, editGreenie, prepareForRefresh };
}
