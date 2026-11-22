"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  getInstallBannerMode,
  type InstallBannerMode,
} from "./install-banner-mode";

// Chromium-only event, missing from the DOM typings. `prompt()` settles once
// the user accepts or dismisses the install dialog.
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<unknown> };

const IOS_MARKED_INSTALLED_KEY = "opencaddie:iosMarkedInstalled";

// Chromium fires `beforeinstallprompt` once per page load, so it is held at
// module scope to survive the banner unmounting on client-side navigation.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

function setDeferredPrompt(event: BeforeInstallPromptEvent | null) {
  deferredPrompt = event;
  promptListeners.forEach((listener) => listener());
}

function subscribeToPrompt(onChange: () => void) {
  promptListeners.add(onChange);
  return () => promptListeners.delete(onChange);
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    setDeferredPrompt(event as BeforeInstallPromptEvent);
  });
  window.addEventListener("appinstalled", () => setDeferredPrompt(null));
}

const neverChanges = () => () => {};

function subscribeToStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function isStandalone() {
  const navigatorWithStandalone = navigator as Navigator & {
    standalone?: boolean;
  };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

function isTouchDevice() {
  return window.matchMedia("(pointer: coarse)").matches;
}

function isIos() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac, so touch support tells them apart.
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  );
}

function iosMarkedInstalled() {
  return window.localStorage.getItem(IOS_MARKED_INSTALLED_KEY) === "true";
}

// `null` on the server and during hydration, so the banner renders only once
// the browser can say whether it belongs.
function useBrowserFlag(
  read: () => boolean,
  subscribe: (onChange: () => void) => () => void = neverChanges,
) {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function useInstallBanner(): {
  mode: InstallBannerMode;
  install: () => Promise<void>;
  markInstalledOnIos: () => void;
} {
  const standalone = useBrowserFlag(isStandalone);
  const touchDevice = useBrowserFlag(isTouchDevice);
  const ios = useBrowserFlag(isIos);
  const markedInstalled = useBrowserFlag(
    iosMarkedInstalled,
    subscribeToStorage,
  );
  const promptEvent = useSyncExternalStore(
    subscribeToPrompt,
    () => deferredPrompt,
    () => null,
  );

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    // A prompt event can only be shown once; Chromium fires a fresh one if
    // the user dismissed and can still install.
    setDeferredPrompt(null);
  }, []);

  const markInstalledOnIos = useCallback(() => {
    window.localStorage.setItem(IOS_MARKED_INSTALLED_KEY, "true");
    window.dispatchEvent(new StorageEvent("storage"));
  }, []);

  const mode =
    standalone === null ||
    touchDevice === null ||
    ios === null ||
    markedInstalled === null
      ? "hidden"
      : getInstallBannerMode({
          isStandalone: standalone,
          isTouchDevice: touchDevice,
          isIos: ios,
          canPrompt: promptEvent !== null,
          iosMarkedInstalled: markedInstalled,
        });

  return { mode, install, markInstalledOnIos };
}
