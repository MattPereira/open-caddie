"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  hasInstallPrompt,
  showInstallPrompt,
  subscribeToInstallPrompt,
} from "./install-prompt-store";

import {
  getInstallBannerMode,
  type InstallBannerMode,
} from "./install-banner-mode";

const IOS_MARKED_INSTALLED_KEY = "opencaddie:iosMarkedInstalled";

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
  const canPrompt = useSyncExternalStore(
    subscribeToInstallPrompt,
    hasInstallPrompt,
    () => false,
  );

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
          canPrompt,
          iosMarkedInstalled: markedInstalled,
        });

  return { mode, install: showInstallPrompt, markInstalledOnIos };
}
