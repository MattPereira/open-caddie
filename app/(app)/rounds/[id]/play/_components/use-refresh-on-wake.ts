"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-reads the page whenever it comes back on screen.
 *
 * The play form is a long-lived page on a phone that spends most of a round
 * locked in a pocket, and nothing re-reads the Round while it sits there — so
 * the card a player unlocks to is as old as the last time they looked at it.
 * Waking is also the only moment freshness is judged, which is why this earns
 * its keep without a poll behind it.
 *
 * Safe to fire mid-save: the form holds its unconfirmed edits over the server
 * snapshot, so a refresh that lands before a score does cannot blank the cell.
 */
export function useRefreshOnWake(prepareForRefresh: () => void) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      prepareForRefresh();
      router.refresh();
    };

    // Safari can restore this page from the back/forward cache without a
    // visibility change, so that event has to be listened for too — but only
    // for a restore. `pageshow` also fires on a first load, which has just read
    // the Round and would be refetching it for nothing.
    const refreshOnRestore = (event: PageTransitionEvent) => {
      if (event.persisted) refresh();
    };

    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pageshow", refreshOnRestore);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("pageshow", refreshOnRestore);
    };
  }, [prepareForRefresh, router]);
}
