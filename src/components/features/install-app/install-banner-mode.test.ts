import { describe, expect, it } from "vitest";

import {
  getInstallBannerMode,
  type InstallEnvironment,
} from "./install-banner-mode";

const androidChromeReadyToInstall: InstallEnvironment = {
  isStandalone: false,
  isTouchDevice: true,
  isIos: false,
  canPrompt: true,
  iosMarkedInstalled: false,
};

describe("getInstallBannerMode", () => {
  it("hides the banner inside the installed app", () => {
    expect(
      getInstallBannerMode({
        ...androidChromeReadyToInstall,
        isStandalone: true,
      }),
    ).toBe("hidden");
  });

  it("offers the native install prompt on a phone that can install", () => {
    expect(getInstallBannerMode(androidChromeReadyToInstall)).toBe("prompt");
  });

  it("hides the banner on desktop even when the browser can install", () => {
    expect(
      getInstallBannerMode({
        ...androidChromeReadyToInstall,
        isTouchDevice: false,
      }),
    ).toBe("hidden");
  });

  it("hides the banner off iOS when the browser never offers an install prompt", () => {
    expect(
      getInstallBannerMode({
        ...androidChromeReadyToInstall,
        canPrompt: false,
      }),
    ).toBe("hidden");
  });

  describe("on iOS, which has no install prompt", () => {
    const iosSafari: InstallEnvironment = {
      isStandalone: false,
      isTouchDevice: true,
      isIos: true,
      canPrompt: false,
      iosMarkedInstalled: false,
    };

    it("shows Add to Home Screen instructions", () => {
      expect(getInstallBannerMode(iosSafari)).toBe("ios-instructions");
    });

    it("hides the banner once the user says it is already installed", () => {
      expect(
        getInstallBannerMode({ ...iosSafari, iosMarkedInstalled: true }),
      ).toBe("hidden");
    });

    it("hides the banner when opened from the Home Screen", () => {
      expect(getInstallBannerMode({ ...iosSafari, isStandalone: true })).toBe(
        "hidden",
      );
    });
  });
});
