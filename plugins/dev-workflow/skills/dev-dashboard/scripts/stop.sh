#!/usr/bin/env bash
# Stop the bundled dev-dashboard server process.
#
# Usage: bash stop.sh
#
# Output:
#   stopped:<pid-list>  — matched bundled server processes were stopped
#   idle                — no bundled dev-dashboard process found
#   error:<message>     — stop failed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DASHBOARD_DIR="$(cd "$SCRIPT_DIR/.." && pwd)/dashboard"
SERVER_ENTRY="$DASHBOARD_DIR/server/index.cjs"

# Cross-version process matching: this pattern is the stable suffix of every
# bundled dev-dashboard server path (both the marketplace-cached install layout
# `…/cache/dev-workflow/dev-workflow/<version>/skills/dev-dashboard/dashboard/server/index.cjs`
# and the contributor-mode layout `…/plugins/dev-workflow/skills/dev-dashboard/dashboard/server/index.cjs`).
# Matching on this suffix instead of the current install's absolute `$SERVER_ENTRY`
# lets `dev-dashboard-stop` kill a server still bound to a prior version's cache
# path after a `/plugin update` — otherwise the stale process keeps the port and
# the next `dev-dashboard` start either fails or picks a different port.
SERVER_ENTRY_PATTERN="/skills/dev-dashboard/dashboard/server/index.cjs"

if [ ! -f "$SERVER_ENTRY" ]; then
  echo "error:Bundled server not found at $SERVER_ENTRY"
  exit 1
fi

find_pids() {
  if command -v pgrep >/dev/null 2>&1; then
    local pgrep_output
    pgrep_output="$(pgrep -f "$SERVER_ENTRY_PATTERN" 2>/dev/null || true)"
    if [ -n "$pgrep_output" ]; then
      printf '%s\n' "$pgrep_output"
      return 0
    fi
  fi

  if command -v ps >/dev/null 2>&1; then
    ps -ax -o pid= -o command= | while IFS= read -r line; do
      case "$line" in
        *"$SERVER_ENTRY_PATTERN"*)
          pid="${line%% *}"
          pid="${pid#"${pid%%[![:space:]]*}"}"
          printf '%s\n' "$pid"
          ;;
      esac
    done
  fi
}

pids="$(find_pids)"

if [ -z "$pids" ]; then
  echo "idle"
  exit 0
fi

if ! echo "$pids" | xargs kill; then
  echo "error:Failed to stop dev-dashboard process"
  exit 1
fi

echo "stopped:${pids//$'\n'/,}"
