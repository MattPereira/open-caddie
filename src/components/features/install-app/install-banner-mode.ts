export type InstallEnvironment = {
  isStandalone: boolean;
  isTouchDevice: boolean;
  isIos: boolean;
  canPrompt: boolean;
  iosMarkedInstalled: boolean;
};

export type InstallBannerMode = "prompt" | "ios-instructions" | "hidden";

export function getInstallBannerMode(
  environment: InstallEnvironment,
): InstallBannerMode {
  if (environment.isStandalone || !environment.isTouchDevice) return "hidden";
  if (environment.isIos) {
    return environment.iosMarkedInstalled ? "hidden" : "ios-instructions";
  }
  return environment.canPrompt ? "prompt" : "hidden";
}
