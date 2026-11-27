export function ok<T extends { ok: boolean }>(
  result: T,
  what: string,
): Extract<T, { ok: true }> {
  if (!result.ok) {
    throw new Error(`Seeding ${what} failed: ${JSON.stringify(result)}`);
  }
  return result as Extract<T, { ok: true }>;
}
