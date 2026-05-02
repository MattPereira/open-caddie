export function slugify(first: string, last: string): string {
  const combined = `${first}-${last}`.toLowerCase();
  return combined
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
}
