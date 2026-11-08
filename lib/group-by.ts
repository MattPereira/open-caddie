/** Rows grouped by `key` in input order, each mapped through `value`. */
export function groupBy<T, K, V = T>(
  rows: readonly T[],
  key: (row: T) => K,
  value: (row: T) => V = (row) => row as unknown as V,
) {
  const groups = new Map<K, V[]>();
  for (const row of rows) {
    const group = groups.get(key(row));
    if (group) group.push(value(row));
    else groups.set(key(row), [value(row)]);
  }
  return groups;
}
