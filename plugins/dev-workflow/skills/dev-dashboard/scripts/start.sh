#!/usr/bin/env bash
# Start the dev-dashboard server, reusing an existing instance if found.
#
# Usage: bash start.sh <dashboard-dir>
#
# Output (one of):
#   running:<port>    — our server is already running on this port
#   started:<port>    — we started a new server on this port
#   error:<message>   — could not start
#
# Requires: curl, node

set -euo pipefail

DASHBOARD_DIR="${1:?Usage: start.sh <dashboard-dir>}"
DEFAULT_PORT=3141
MAX_TRIES=10

# Check if a dev-dashboard instance is running on a given port
check_our_server() {
  local port="$1"
  local resp
  resp=$(curl -s --max-time 2 "http://localhost:${port}/api/health" 2>/dev/null) || return 1
  # Verify it's our server by checking for the "status":"ok" field
  echo "$resp" | grep -q '"status"' && return 0 || return 1
}

# Check if any process is listening on a port
port_in_use() {
  local port="$1"
  # Use curl with a very short timeout — connection refused means port is free
  curl -s --max-time 1 "http://localhost:${port}/" -o /dev/null 2>/dev/null
}

# Ensure build exists
if [ ! -f "$DASHBOARD_DIR/dist/server/index.js" ]; then
  echo "error:Server not built. Run 'npm run build' in $DASHBOARD_DIR"
  exit 1
fi

# Ensure dependencies
if [ ! -d "$DASHBOARD_DIR/node_modules" ]; then
  npm --prefix "$DASHBOARD_DIR" install --silent 2>/dev/null || {
    echo "error:Failed to install dependencies in $DASHBOARD_DIR"
    exit 1
  }
fi

# Scan ports starting from DEFAULT_PORT
port=$DEFAULT_PORT
found_existing=""
found_port=""

for ((i = 0; i < MAX_TRIES; i++)); do
  candidate=$((port + i))

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
nohup node "$DASHBOARD_DIR/dist/server/index.js" --port "$found_port" \
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
