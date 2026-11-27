#!/usr/bin/env bash
set -euo pipefail

start() {
  local port=$1 database_url=$2 dist_dir=${3:-} tsconfig=${4:-}
  DATABASE_URL="$database_url" AUTH_URL="http://localhost:$port" \
    NEXT_DIST_DIR="$dist_dir" NEXT_TSCONFIG_PATH="$tsconfig" \
    nohup "$GITHUB_ACTION_PATH/serve-dev.sh" "$port" "$dist_dir" >> "/tmp/app-$port.log" 2>&1 &
}

# Separate data caches keep rows from leaking between databases. Only the
# seed gets the restored cache: copying it to another distDir makes
# Turbopack hang and allocate ~700 MB/s until it is OOM-killed.
start 3000 "$DATABASE_URL"
ports=(3000)
for n in $BUG_REPORTS; do
  port=$((3000 + n))
  rm -rf ".next/bug-$n"
  mkdir -p ".next/bug-$n"
  # Next rewrites its tsconfig; keep each snapshot's changes out of ours.
  echo '{ "extends": "./tsconfig.json" }' > "tsconfig.bug-$n.json"
  start "$port" "${DATABASE_URL%/*}/open_caddie_bug_$n" ".next/bug-$n" "tsconfig.bug-$n.json"
  ports+=("$port")
done

# A corrupt restored cache can hang startup. serve-dev.sh restarts cold
# after a kill, logging "[setup-agent]"; only act on corruption since then.
corrupt_since_restart='/\[setup-agent\]/ { c = 0 } /Cache corruption detected/ { c = 1 } END { exit !c }'
deadline=$((SECONDS + 300))
for port in "${ports[@]}"; do
  until curl -s -o /dev/null --max-time 30 "http://localhost:$port/"; do
    if [ "$SECONDS" -ge "$deadline" ]; then
      echo "::error::The server on localhost:$port did not answer within five minutes."
      cat "/tmp/app-$port.log"
      exit 1
    fi
    if awk "$corrupt_since_restart" "/tmp/app-$port.log"; then
      echo "::warning::The dev server on localhost:$port found its cache corrupt; restarting it cold."
      pkill -f "^node .*next dev -p $port\$" || true
      sleep 5
    fi
    sleep 1
  done
done
