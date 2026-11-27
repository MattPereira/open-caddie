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

# Each cold server peaks around 3G; 5G leaves room for route compilation
# while keeping two servers, the agent and Chrome within a 16G runner.
memory_max=${CI_DEV_MEMORY_MAX:-5G}
environment=()
while IFS= read -r -d '' variable; do
  environment+=(--setenv="$variable")
done < <(env -0)

while :; do
  unit="setup-agent-$port-$$-$RANDOM"
  # sudo otherwise drops the app's environment and runs Next as root.
  sudo -n systemd-run --scope --quiet --unit="$unit" \
    --uid="$(id -u)" --gid="$(id -g)" --same-dir \
    --expand-environment=no "${environment[@]}" \
    -p "MemoryMax=$memory_max" -p MemorySwapMax=0 \
    -- node_modules/.bin/next dev -p "$port"
  status=$?
  if [ "$(systemctl show -P Result "$unit.scope" 2>/dev/null)" = oom-kill ]; then
    echo "[setup-agent] The server on port $port hit MemoryMax=$memory_max and was killed (oom-kill)."
    systemctl show -p MemoryPeak "$unit.scope"
  fi
  sudo -n systemctl reset-failed "$unit.scope" 2>/dev/null || true
  # A server that died mid-write can leave Turbopack's cache corrupt, and a
  # corrupt cache can hang the next server, so restart cold.
  rm -rf "$cache"
  echo "[setup-agent] next dev exited ($status); restarting it without its cache in 2s."
  sleep 2
done
