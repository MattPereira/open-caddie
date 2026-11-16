/**
 * Narrows away null/undefined where an invariant the types can't express says
 * the value exists. Throws with `what` instead of failing somewhere later.
 */
export function required<T>(value: T | null | undefined, what: string): T {
  if (value == null) throw new Error(`Expected ${what}`);
  return value;
}
