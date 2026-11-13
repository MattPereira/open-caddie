export const IMAGE_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;
export const SCORECARD_IMAGE_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

export function getImageUploadMaxBytes(pathname: string) {
  if (
    pathname.startsWith("round-scorecards/") ||
    /^courses\/[^/]+\/scorecards\//.test(pathname)
  ) {
    return SCORECARD_IMAGE_UPLOAD_MAX_BYTES;
  }

  return IMAGE_UPLOAD_MAX_BYTES;
}
