"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";

const storageKey = (roundId: number) =>
  `opencaddie:delegateRoundIds:${roundId}`;

const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
};

const EMPTY: readonly number[] = [];

const parse = (raw: string | null): readonly number[] => {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const ids = parsed.filter(
      (v): v is number => Number.isInteger(v) && v > 0,
    );
    return ids.length === 0 ? EMPTY : ids;
  } catch {
    return EMPTY;
  }
};

export function useDelegateRoundIds(roundId: number) {
  const cacheRef = useRef<{ raw: string | null; value: readonly number[] }>({
    raw: null,
    value: EMPTY,
  });

  const getSnapshot = useCallback(() => {
    const raw = window.localStorage.getItem(storageKey(roundId));
    if (raw === cacheRef.current.raw) return cacheRef.current.value;
    cacheRef.current = { raw, value: parse(raw) };
    return cacheRef.current.value;
  }, [roundId]);

  const delegateRoundIds = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => EMPTY,
  );

  const setDelegateRoundIds = useCallback(
    (next: readonly number[]) => {
      if (next.length === 0) {
        window.localStorage.removeItem(storageKey(roundId));
      } else {
        window.localStorage.setItem(storageKey(roundId), JSON.stringify(next));
      }
      window.dispatchEvent(new StorageEvent("storage"));
    },
    [roundId],
  );

  return [delegateRoundIds, setDelegateRoundIds] as const;
}
