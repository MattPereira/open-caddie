// Progressive enhancement: iOS Safari has never implemented navigator.vibrate,
// so every call is a no-op there rather than a TypeError inside a tap handler.

export type HapticKind = "tick" | "commit" | "clear" | "error";

// Android's practical floor is ~10ms; shorter buzzes are inconsistent across
// OEMs and read as nothing at all.
const PATTERNS: Record<HapticKind, number | number[]> = {
  tick: 10,
  commit: [0, 25],
  clear: [0, 15, 40, 15],
  error: [0, 60, 60, 60],
};

export function haptic(kind: HapticKind) {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  navigator.vibrate(PATTERNS[kind]);
}
