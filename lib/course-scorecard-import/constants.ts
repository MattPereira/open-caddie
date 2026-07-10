// Client-safe constants for the course scorecard import flow.
// Kept free of server imports (db, drizzle, schema) so client components can
// import these values without pulling the import module — and `pg` — into the
// browser bundle. `index.ts` re-exports them for server-side use.

export const TEE_RATING_MIN = 0;
export const TEE_SLOPE_MIN = 55;
export const TEE_SLOPE_MAX = 155;
