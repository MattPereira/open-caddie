// @vitest-environment jsdom

import { act, createElement, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteRoundGreenie,
  upsertRoundGreenie,
  upsertRoundScore,
} from "../../../actions";
import type { ScoreEntry } from "./round-score-state";
import { useLiveScorecard, type GreenieEntry } from "./use-live-scorecard";

const { router } = vi.hoisted(() => ({ router: { refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../../../actions", () => ({
  upsertRoundScore: vi.fn(),
  upsertRoundGreenie: vi.fn(),
  deleteRoundGreenie: vi.fn(),
}));

type SaveResult = { ok: true } | { ok: false; error: string };
function pendingSave() {
  let resolve!: (result: SaveResult) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<SaveResult>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const score = (strokes: number | null): ScoreEntry => ({
  hole: 1,
  par: 4,
  yards: 400,
  strokes,
  putts: strokes == null ? null : 2,
});
const patch = (strokes: number) => ({ strokes, putts: 2 });

let root: Root;
let container: HTMLDivElement;
let current: ReturnType<typeof useLiveScorecard>;
let scores: Record<number, ScoreEntry[]>;
let greenies: Record<number, GreenieEntry[]>;

function Card() {
  const card = useLiveScorecard(scores, greenies);
  useLayoutEffect(() => {
    current = card;
  }, [card]);
  return null;
}
function snapshot(strokes: number | null, nextGreenies: GreenieEntry[] = []) {
  scores = { 1: [score(strokes)], 2: [score(null)] };
  greenies = { 1: nextGreenies, 2: [] };
  act(() => root.render(createElement(Card)));
}
function wake() {
  act(() => document.dispatchEvent(new Event("visibilitychange")));
}
function saveScore(strokes: number, roundId = 1) {
  act(() => current.saveScore(roundId, 1, patch(strokes)));
}
function strokes(roundId = 1) {
  return current.scoresByRoundId[roundId][0].strokes;
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  vi.mocked(upsertRoundScore).mockResolvedValue({ ok: true });
  vi.mocked(upsertRoundGreenie).mockResolvedValue({ ok: true });
  vi.mocked(deleteRoundGreenie).mockResolvedValue({ ok: true });
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  snapshot(null);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("live scorecard lifecycle", () => {
  it("saves optimistically and lets a wake snapshot replace an accepted score", async () => {
    const save = pendingSave();
    vi.mocked(upsertRoundScore).mockReturnValueOnce(save.promise);
    saveScore(5);
    expect(strokes()).toBe(5);
    expect(upsertRoundScore).toHaveBeenCalledWith({
      roundId: 1,
      hole: 1,
      strokes: 5,
      putts: 2,
    });
    await act(async () => save.resolve({ ok: true }));
    // Ordinary snapshots cannot retire an edit before a refresh starts.
    snapshot(4);
    expect(strokes()).toBe(5);
    wake();
    expect(router.refresh).toHaveBeenCalledOnce();
    snapshot(6);
    expect(strokes()).toBe(6);
  });

  it("keeps pending scores over snapshots, for peer Rounds", async () => {
    const save = pendingSave();
    vi.mocked(upsertRoundScore).mockReturnValueOnce(save.promise);
    saveScore(5, 2);
    wake();
    snapshot(null);
    expect(strokes(2)).toBe(5);
    await act(async () => save.resolve({ ok: true }));
  });

  it("keeps a save accepted after refresh began until the next wake", async () => {
    const save = pendingSave();
    vi.mocked(upsertRoundScore).mockReturnValueOnce(save.promise);
    saveScore(5);
    wake();
    await act(async () => save.resolve({ ok: true }));
    snapshot(6);
    expect(strokes()).toBe(5);
    wake();
    snapshot(6);
    expect(strokes()).toBe(6);
  });

  it("marks retirement before requesting even a synchronous refresh snapshot", async () => {
    await act(async () => current.saveScore(1, 1, patch(5)));
    router.refresh.mockImplementationOnce(() => snapshot(6));
    wake();
    expect(strokes()).toBe(6);
  });

  it("reveals refreshed server data when a newer edit fails", async () => {
    await act(async () => current.saveScore(1, 1, patch(5)));
    const save = pendingSave();
    vi.mocked(upsertRoundScore).mockReturnValueOnce(save.promise);
    saveScore(7);
    wake();
    snapshot(6);
    await act(async () => save.resolve({ ok: false, error: "Score rejected" }));
    expect(strokes()).toBe(6);
    expect(current.saveError).toBe("Score rejected");
  });

  it("keeps a newer edit and suppresses the older edit's failure", async () => {
    const older = pendingSave();
    const newer = pendingSave();
    vi.mocked(upsertRoundScore)
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    saveScore(5);
    saveScore(7);
    await act(async () =>
      older.resolve({ ok: false, error: "Obsolete failure" }),
    );
    expect(strokes()).toBe(7);
    expect(current.saveError).toBeNull();
    await act(async () => newer.resolve({ ok: true }));
  });

  it("reveals an older pending edit when the newest edit fails", async () => {
    const older = pendingSave();
    const newer = pendingSave();
    vi.mocked(upsertRoundScore)
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    saveScore(5);
    saveScore(7);
    await act(async () => newer.resolve({ ok: false, error: "Rejected" }));
    expect(strokes()).toBe(5);
    await act(async () => older.resolve({ ok: true }));
    expect(current.saveError).toBe("Rejected");
  });

  it("rolls back thrown saves and clears the error on the next edit", async () => {
    const save = pendingSave();
    vi.mocked(upsertRoundScore).mockReturnValueOnce(save.promise);
    saveScore(5);
    await act(async () => save.reject(new Error("Transport failed")));
    expect(strokes()).toBeNull();
    expect(current.saveError).toBe("Could not save. Please try again.");
    await act(async () => current.saveScore(1, 1, patch(6)));
    expect(current.saveError).toBeNull();
    expect(strokes()).toBe(6);
  });

  it("preserves a newer accepted edit when an older save throws", async () => {
    const older = pendingSave();
    vi.mocked(upsertRoundScore).mockReturnValueOnce(older.promise);
    saveScore(5);
    await act(async () => current.saveScore(1, 1, patch(7)));
    await act(async () => older.reject(new Error("Old request failed")));
    expect(strokes()).toBe(7);
    expect(current.saveError).toBeNull();
  });

  it("sends only the changed field and layers it over an earlier pending edit", async () => {
    const older = pendingSave();
    vi.mocked(upsertRoundScore).mockReturnValueOnce(older.promise);
    act(() => current.saveScore(1, 1, { strokes: 5 }));
    await act(async () => current.saveScore(1, 1, { putts: 1 }));
    expect(upsertRoundScore).toHaveBeenLastCalledWith({
      roundId: 1,
      hole: 1,
      putts: 1,
    });
    expect(current.scoresByRoundId[1][0]).toMatchObject({
      strokes: 5,
      putts: 1,
    });
    await act(async () => older.resolve({ ok: true }));
  });

  it("saves Greenies and reconciles them through the same wake lifecycle", async () => {
    await act(async () => current.saveGreenie(2, 1, { feet: 4, inches: 3 }));
    expect(upsertRoundGreenie).toHaveBeenCalledWith({
      roundId: 2,
      hole: 1,
      feet: 4,
      inches: 3,
    });
    expect(current.greeniesByRoundId[2]).toEqual([
      { hole: 1, feet: 4, inches: 3 },
    ]);
    wake();
    snapshot(null);
    expect(current.greeniesByRoundId[2]).toEqual([]);
  });

  it("restores a Greenie when deletion throws, then accepts a successful deletion", async () => {
    const original = { hole: 1, feet: 4, inches: 0 };
    snapshot(4, [original]);
    const save = pendingSave();
    vi.mocked(deleteRoundGreenie).mockReturnValueOnce(save.promise);
    act(() => current.removeGreenie(1, 1));
    expect(current.greeniesByRoundId[1]).toEqual([]);
    await act(async () => save.reject(new Error("Offline")));
    expect(current.greeniesByRoundId[1]).toEqual([original]);
    expect(current.saveError).toBeTruthy();
    await act(async () => current.removeGreenie(1, 1));
    expect(deleteRoundGreenie).toHaveBeenLastCalledWith({
      roundId: 1,
      hole: 1,
    });
    expect(current.greeniesByRoundId[1]).toEqual([]);
    wake();
    snapshot(4, [{ hole: 1, feet: 8, inches: 6 }]);
    expect(current.greeniesByRoundId[1]).toEqual([
      { hole: 1, feet: 8, inches: 6 },
    ]);
  });

  it("rolls back a rejected Greenie without disturbing a score save", async () => {
    const original = { hole: 1, feet: 4, inches: 0 };
    snapshot(4, [original]);
    const save = pendingSave();
    vi.mocked(upsertRoundGreenie).mockReturnValueOnce(save.promise);
    act(() => current.saveGreenie(1, 1, { feet: 8, inches: 0 }));
    expect(current.greeniesByRoundId[1]).toEqual([
      { hole: 1, feet: 8, inches: 0 },
    ]);
    await act(async () => current.saveScore(1, 1, patch(6)));
    await act(async () =>
      save.resolve({ ok: false, error: "Greenie rejected" }),
    );
    expect(current.greeniesByRoundId[1]).toEqual([original]);
    expect(strokes()).toBe(6);
    expect(current.saveError).toBe("Greenie rejected");
  });

  it("refreshes only on visible wakes and back/forward restores, and cleans up", () => {
    expect(router.refresh).not.toHaveBeenCalled();
    act(() =>
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: false }),
      ),
    );
    expect(router.refresh).not.toHaveBeenCalled();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    wake();
    act(() =>
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true }),
      ),
    );
    expect(router.refresh).not.toHaveBeenCalled();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    wake();
    act(() =>
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true }),
      ),
    );
    expect(router.refresh).toHaveBeenCalledTimes(2);
    act(() => root.unmount());
    wake();
    act(() =>
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true }),
      ),
    );
    expect(router.refresh).toHaveBeenCalledTimes(2);
    // Give afterEach a mounted root to clean up.
    root = createRoot(container);
  });
});
