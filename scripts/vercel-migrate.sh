#!/usr/bin/env bash
# Vercel build step: migrate the production database (ADR 0006).
set -euo pipefail

if [[ "${VERCEL_ENV:-}" != "production" ]]; then
  echo "Skipping migrations: only production builds migrate (ADR 0006)"
  exit 0
fi

: "${DATABASE_URL_UNPOOLED:?DATABASE_URL_UNPOOLED is not set}"
host=$(sed -E 's#^[^@]*@([^/:?]+).*#\1#' <<<"$DATABASE_URL_UNPOOLED")
echo "Migrating production database at $host"

# drizzle.config.ts reads DATABASE_URL; migrations need the direct connection.
DATABASE_URL="$DATABASE_URL_UNPOOLED" pnpm db:migrate
