#!/usr/bin/env bash
set -euo pipefail
supervisor=$(realpath "$1")
fixture=$(mktemp -d)
trap 'kill "${supervisor_pid:-}" 2>/dev/null || true; if [ -f "$fixture/healthy.pid" ]; then kill "$(cat "$fixture/healthy.pid")" 2>/dev/null || true; fi; rm -rf "$fixture"' EXIT
mkdir -p "$fixture/node_modules/.bin" "$fixture/.next/dev/cache"
touch "$fixture/.next/dev/cache/corrupt"
cat_source=$(dirname "$0")/next.py
cp "$cat_source" "$fixture/node_modules/.bin/next"
chmod +x "$fixture/node_modules/.bin/next"
cd "$fixture"
export CHECK_ENV='literal $HOME spaces and "quotes"'
CI_DEV_MEMORY_MAX=512M bash "$supervisor" 3999 > server.log 2>&1 &
supervisor_pid=$!
for _ in $(seq 60); do
  [ -f healthy.pid ] && break
  sleep 1
done
cat server.log
test -f healthy.pid
kill -0 "$supervisor_pid"
grep -q 'hit MemoryMax=512M.*oom-kill' server.log
test "$(find . -not -uid "$(id -u)" -print -quit)" = ''
echo 'PASS: OOM killed only server; supervisor survived; cold replacement healthy; cwd/environment/ownership preserved.'
