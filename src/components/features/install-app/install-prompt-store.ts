"use client";

// Chromium-only event, missing from the DOM typings. `prompt()` settles once
// the user accepts or dismisses the install dialog.
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<unknown> };

// Chromium fires `beforeinstallprompt` once, early in the page load, so it is
// caught at module scope by a listener the root layout loads on every page.
// The home-page banner can then read it after any client-side navigation.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

function setDeferredPrompt(event: BeforeInstallPromptEvent | null) {
  deferredPrompt = event;
  promptListeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    setDeferredPrompt(event as BeforeInstallPromptEvent);
  });
  window.addEventListener("appinstalled", () => setDeferredPrompt(null));
}

export function subscribeToInstallPrompt(onChange: () => void) {
  promptListeners.add(onChange);
  return () => {
    promptListeners.delete(onChange);
  };
}

export function hasInstallPrompt() {
  return deferredPrompt !== null;
}

export async function showInstallPrompt() {
  if (!deferredPrompt) return;
  const event = deferredPrompt;
  // A prompt event can only be shown once. If the user dismisses it,
  // Chromium may fire a fresh one later, which brings the banner back.
  setDeferredPrompt(null);
  await event.prompt();
}
