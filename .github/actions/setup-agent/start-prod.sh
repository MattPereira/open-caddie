#!/usr/bin/env bash
set -euo pipefail

pnpm build

start() {
  local port=$1 database_url=$2 dist_dir=${3:-}
  DATABASE_URL="$database_url" AUTH_URL="http://localhost:$port" \
    NEXT_DIST_DIR="$dist_dir" NEXT_TSCONFIG_PATH="" \
    nohup pnpm start -p "$port" >> "/tmp/app-$port.log" 2>&1 &
}

# Separate data caches keep rows from leaking between databases.
start 3000 "$DATABASE_URL"
ports=(3000)
for n in $BUG_REPORTS; do
  port=$((3000 + n))
  rm -rf ".next/bug-$n"
  mkdir -p ".next/bug-$n"
  rsync -a --exclude=/cache --exclude=/dev --exclude='/bug-*' .next/ ".next/bug-$n/"
  start "$port" "${DATABASE_URL%/*}/open_caddie_bug_$n" ".next/bug-$n"
  ports+=("$port")
done

deadline=$((SECONDS + 300))
for port in "${ports[@]}"; do
  until curl -s -o /dev/null --max-time 30 "http://localhost:$port/"; do
    if [ "$SECONDS" -ge "$deadline" ]; then
      echo "::error::The server on localhost:$port did not answer within five minutes."
      cat "/tmp/app-$port.log"
      exit 1
    fi
    sleep 1
  done
done
