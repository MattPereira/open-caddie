"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";

const storageKey = (roundId: number) =>
  `opencaddie:delegateRoundIds:${roundId}`;

const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
};

const EMPTY: readonly number[] = [];

const parse = (raw: string | null): readonly number[] | null => {
  if (raw == null) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((v): v is number => Number.isInteger(v) && v > 0);
  } catch {
    return null;
  }
};

// `null` means the player has never chosen for this Round, which is the only
// condition that lets a caller prefill; an empty array means they chose nobody
// and must survive a reload as such.
export function readDelegateRoundIds(roundId: number) {
  return parse(window.localStorage.getItem(storageKey(roundId)));
}

export function writeDelegateRoundIds(
  roundId: number,
  delegateRoundIds: readonly number[],
) {
  window.localStorage.setItem(
    storageKey(roundId),
    JSON.stringify(delegateRoundIds),
  );
}

const same = (a: readonly number[] | null, b: readonly number[] | null) =>
  a === b ||
  (a != null &&
    b != null &&
    a.length === b.length &&
    a.every((id, index) => id === b[index]));

export function useDelegateRoundIds(
  roundId: number,
  prefillDelegateRoundIds: readonly number[] = EMPTY,
) {
  const cacheRef = useRef<readonly number[] | null>(null);

  // `useSyncExternalStore` needs a stable snapshot, and every read parses a
  // fresh array, so an unchanged selection is handed back its last identity.
  const getSnapshot = useCallback(() => {
    const next = readDelegateRoundIds(roundId);
    if (same(cacheRef.current, next)) return cacheRef.current;
    cacheRef.current = next;
    return next;
  }, [roundId]);

  const storedRoundIds = useSyncExternalStore(subscribe, getSnapshot, () => null);

  const setDelegateRoundIds = useCallback(
    (next: readonly number[]) => {
      writeDelegateRoundIds(roundId, next);
      window.dispatchEvent(new StorageEvent("storage"));
    },
    [roundId],
  );

  return [storedRoundIds ?? prefillDelegateRoundIds, setDelegateRoundIds] as const;
}
