#!/usr/bin/env bash
# Vercel build step: migrate this deployment's Neon branch (ADR 0006).
set -euo pipefail

# Prod's read-write endpoint; the Neon-Vercel integration blocks deleting it.
# Preview builds also inherit project-level prod connection vars, so refuse to
# migrate prod unless the integration has swapped in the preview branch's URL.
PROD_ENDPOINT="ep-floral-rain-akxwvt27"

: "${DATABASE_URL_UNPOOLED:?DATABASE_URL_UNPOOLED is not set}"
host=$(sed -E 's#^[^@]*@([^/:?]+).*#\1#' <<<"$DATABASE_URL_UNPOOLED")
echo "Migrating ${VERCEL_ENV:-unknown} database at $host"

if [[ "${VERCEL_ENV:-}" != "production" && "$host" == "$PROD_ENDPOINT".* ]]; then
  echo "Refusing to migrate prod from a ${VERCEL_ENV:-non-production} build" >&2
  exit 1
fi

# drizzle.config.ts reads DATABASE_URL; migrations need the direct connection.
DATABASE_URL="$DATABASE_URL_UNPOOLED" pnpm db:migrate
