"use client";

import { useCallback, useSyncExternalStore } from "react";

const storageKey = (roundId: number) => `opencaddie:delegateRoundId:${roundId}`;

const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
};

const parse = (raw: string | null): number | null => {
  if (raw == null) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export function useDelegateRoundId(roundId: number) {
  const getSnapshot = useCallback(
    () => parse(window.localStorage.getItem(storageKey(roundId))),
    [roundId],
  );

  const delegateRoundId = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => null,
  );

  const setDelegateRoundId = useCallback(
    (next: number | null) => {
      if (next == null) {
        window.localStorage.removeItem(storageKey(roundId));
      } else {
        window.localStorage.setItem(storageKey(roundId), String(next));
      }
      window.dispatchEvent(new StorageEvent("storage"));
    },
    [roundId],
  );

  return [delegateRoundId, setDelegateRoundId] as const;
}
