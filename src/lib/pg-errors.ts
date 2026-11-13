/** The Postgres error code, whether the driver throws it bare or wrapped. */
export function pgCode(e: unknown): string | undefined {
  return (
    (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
    (e as { code?: string })?.code
  );
}
