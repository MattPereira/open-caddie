"use client";

import { useEffect } from "react";

// Agents wait on `[data-hydrated]` before clicking: until hydration, server
// HTML buttons have no handlers. Set in an effect, after hydration, so the
// attribute is never part of what React compares against the server HTML.
export function HydrationMarker() {
  useEffect(() => {
    document.body.dataset.hydrated = "";
  }, []);
  return null;
}
