const MAX_USERNAME_LEN = 20;

export function slugify(first: string, last: string): string {
  const combined = `${first}-${last}`.toLowerCase();
  return combined
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_USERNAME_LEN);
}

/** Attempt 0 is the bare slug; later attempts append `-2`, `-3`, … within the length cap. */
export function usernameCandidate(base: string, attempt: number): string {
  if (attempt === 0) return base;
  const suffix = `-${attempt + 1}`;
  const maxBase = MAX_USERNAME_LEN - suffix.length;
  return base.slice(0, maxBase).replace(/-+$/, "") + suffix;
}
