#!/usr/bin/env bash
# Runs `next dev` on a port forever, so a server the agent kills or crashes
# comes back. setup-agent starts one per database; the runner kills them at
# the end of the job. Usage: serve-dev.sh <port> [dist dir, default .next]
set -u
port=$1
cache="${2:-.next}/dev/cache"

# The parent kills next-server 100ms after a SIGTERM by default, which can cut
# off Turbopack writing its cache.
export NEXT_EXIT_TIMEOUT_MS=10000

while :; do
  node_modules/.bin/next dev -p "$port"
  status=$?
  # A server that died mid-write can leave Turbopack's cache corrupt, and a
  # corrupt cache can hang the next server, so restart cold.
  rm -rf "$cache"
  echo "[setup-agent] next dev exited ($status); restarting it without its cache in 2s."
  sleep 2
done
