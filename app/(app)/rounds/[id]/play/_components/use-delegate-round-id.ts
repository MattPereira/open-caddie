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

export function useDelegateRoundIds(
  roundId: number,
  prefillRoundIds: readonly number[] = EMPTY,
) {
  const cacheRef = useRef<{ raw: string | null; value: readonly number[] | null }>(
    { raw: null, value: null },
  );

  const getSnapshot = useCallback(() => {
    const raw = window.localStorage.getItem(storageKey(roundId));
    if (raw === cacheRef.current.raw) return cacheRef.current.value;
    cacheRef.current = { raw, value: parse(raw) };
    return cacheRef.current.value;
  }, [roundId]);

  const storedRoundIds = useSyncExternalStore(subscribe, getSnapshot, () => null);

  const setDelegateRoundIds = useCallback(
    (next: readonly number[]) => {
      writeDelegateRoundIds(roundId, next);
      window.dispatchEvent(new StorageEvent("storage"));
    },
    [roundId],
  );

  return [storedRoundIds ?? prefillRoundIds, setDelegateRoundIds] as const;
}
