#!/usr/bin/env bash
# Start the dev-dashboard server, reusing an existing instance if found.
#
# Usage: bash start.sh
#   Resolves the bundled server relative to this script's location.
#
# Output (one of):
#   running:<port>    — our server is already running on this port
#   started:<port>    — we started a new server on this port
#   error:<message>   — could not start
#
# Requires: curl, node

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# scripts/ -> skills/dev-dashboard/ -> skills/ -> dev-workflow/ -> dashboard/
DASHBOARD_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)/dashboard"
SERVER_ENTRY="$DASHBOARD_DIR/server/index.cjs"

DEFAULT_PORT=3141
MAX_TRIES=10

# Check if a dev-dashboard instance is running on a given port
check_our_server() {
  local port="$1"
  local resp
  resp=$(curl -s --max-time 2 "http://localhost:${port}/api/health" 2>/dev/null) || return 1
  echo "$resp" | grep -q '"status"' && return 0 || return 1
}

# Check if any process is listening on a port
port_in_use() {
  local port="$1"
  curl -s --max-time 1 "http://localhost:${port}/" -o /dev/null 2>/dev/null
}

# Verify bundled server exists
if [ ! -f "$SERVER_ENTRY" ]; then
  echo "error:Bundled server not found at $SERVER_ENTRY"
  exit 1
fi

# Scan ports starting from DEFAULT_PORT
found_port=""

for ((i = 0; i < MAX_TRIES; i++)); do
  candidate=$((DEFAULT_PORT + i))

  if check_our_server "$candidate"; then
    echo "running:${candidate}"
    exit 0
  fi

  if [ -z "$found_port" ] && ! port_in_use "$candidate"; then
    found_port="$candidate"
  fi
done

if [ -z "$found_port" ]; then
  echo "error:No available port found in range ${DEFAULT_PORT}-$((DEFAULT_PORT + MAX_TRIES - 1))"
  exit 1
fi

# Start the server in background
nohup node "$SERVER_ENTRY" --port "$found_port" \
  > /tmp/dev-dashboard.log 2>&1 &

# Wait briefly for startup
for ((w = 0; w < 10; w++)); do
  sleep 0.5
  if check_our_server "$found_port"; then
    echo "started:${found_port}"
    exit 0
  fi
done

echo "error:Server failed to start — check /tmp/dev-dashboard.log"
exit 1
