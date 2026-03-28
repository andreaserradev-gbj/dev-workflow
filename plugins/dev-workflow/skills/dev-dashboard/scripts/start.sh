#!/usr/bin/env bash
# Start the dev-dashboard server, reusing an existing instance if found.
#
# Usage: bash start.sh [--open]
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
# scripts/ -> skills/dev-dashboard/dashboard/
DASHBOARD_DIR="$(cd "$SCRIPT_DIR/.." && pwd)/dashboard"
SERVER_ENTRY="$DASHBOARD_DIR/server/index.cjs"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/dev-dashboard"
CONFIG_PATH="$CONFIG_DIR/config.json"

DEFAULT_PORT=3141
MAX_TRIES=10
OPEN_BROWSER=false

while [ "$#" -gt 0 ]; do
  case "$1" in
    --open)
      OPEN_BROWSER=true
      shift
      ;;
    *)
      echo "error:Unknown argument: $1"
      exit 1
      ;;
  esac
done

read_configured_port() {
  if [ ! -f "$CONFIG_PATH" ]; then
    echo "$DEFAULT_PORT"
    return 0
  fi

  local configured_port=""
  configured_port="$(
    node -e '
      const fs = require("fs");
      const configPath = process.argv[1];
      try {
        const raw = fs.readFileSync(configPath, "utf8");
        const parsed = JSON.parse(raw);
        const port = parsed.port;
        if (Number.isInteger(port) && port > 0 && port <= 65535) {
          process.stdout.write(String(port));
        }
      } catch {}
    ' "$CONFIG_PATH"
  )"

  if [ -n "$configured_port" ]; then
    echo "$configured_port"
  else
    echo "$DEFAULT_PORT"
  fi
}

append_candidate_port() {
  local candidate="$1"

  if [ "$candidate" -lt 1 ] || [ "$candidate" -gt 65535 ]; then
    return 0
  fi

  for existing in "${CANDIDATE_PORTS[@]:-}"; do
    if [ "$existing" = "$candidate" ]; then
      return 0
    fi
  done

  CANDIDATE_PORTS+=("$candidate")
}

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

open_url() {
  local port="$1"
  local url="http://localhost:${port}"

  if [ "$OPEN_BROWSER" != "true" ]; then
    return 0
  fi

  if command -v open >/dev/null 2>&1; then
    open "$url" >/dev/null 2>&1 || true
    return 0
  fi

  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1 || true
  fi
}

# Verify bundled server exists
if [ ! -f "$SERVER_ENTRY" ]; then
  echo "error:Bundled server not found at $SERVER_ENTRY"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "error:node is required to run dev-dashboard"
  exit 1
fi

# Scan the configured port first, then fall back to nearby ports and the default range.
found_port=""
PREFERRED_PORT="$(read_configured_port)"
CANDIDATE_PORTS=()

append_candidate_port "$PREFERRED_PORT"
for ((i = 1; i < MAX_TRIES; i++)); do
  append_candidate_port $((PREFERRED_PORT + i))
done
for ((i = 0; i < MAX_TRIES; i++)); do
  append_candidate_port $((DEFAULT_PORT + i))
done

for candidate in "${CANDIDATE_PORTS[@]}"; do
  if check_our_server "$candidate"; then
    open_url "$candidate"
    echo "running:${candidate}"
    exit 0
  fi

  if [ -z "$found_port" ] && ! port_in_use "$candidate"; then
    found_port="$candidate"
  fi
done

if [ -z "$found_port" ]; then
  echo "error:No available port found near preferred port ${PREFERRED_PORT}"
  exit 1
fi

# Start the server in background
nohup node "$SERVER_ENTRY" --port "$found_port" \
  > /tmp/dev-dashboard.log 2>&1 &

# Wait briefly for startup
for ((w = 0; w < 10; w++)); do
  sleep 0.5
  if check_our_server "$found_port"; then
    open_url "$found_port"
    echo "started:${found_port}"
    exit 0
  fi
done

echo "error:Server failed to start — check /tmp/dev-dashboard.log"
exit 1
