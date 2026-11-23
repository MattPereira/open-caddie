export type InstallEnvironment = {
  isStandalone: boolean;
  isTouchDevice: boolean;
  isIos: boolean;
  canPrompt: boolean;
  dismissed: boolean;
};

export type InstallBannerMode = "prompt" | "ios-instructions" | "hidden";

export function getInstallBannerMode(
  environment: InstallEnvironment,
): InstallBannerMode {
  if (
    environment.isStandalone ||
    !environment.isTouchDevice ||
    environment.dismissed
  ) {
    return "hidden";
  }
  if (environment.isIos) return "ios-instructions";
  return environment.canPrompt ? "prompt" : "hidden";
}
