#!/usr/bin/env bash
# Launch the dev-dashboard TUI in the foreground.
#
# A TUI is an interactive, foreground process — unlike the dev-dashboard web
# server (start.sh), there is NO port scan, NO health check, and NO nohup
# background. Resolve the bundled ESM entry relative to this script's own
# location and `exec node` it so the TUI inherits this terminal's TTY directly.
#
# Usage: bash launch.sh [--scan <dir>]
#   --scan <dir>   scan a specific directory instead of the stored config / cwd
#
# Requires: node (>= 24)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# scripts/ -> skills/dev-dashboard-tui/tui/cli.mjs
TUI_ENTRY="$SCRIPT_DIR/../tui/cli.mjs"

if [ ! -f "$TUI_ENTRY" ]; then
  echo "error: bundled TUI not found at $TUI_ENTRY" >&2
  echo "       rebuild it with: cd tools/dev-dashboard-tui && npm run bundle" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "error: node is required to run the dev-dashboard TUI" >&2
  exit 1
fi

# Foreground exec: replace this shell so the Ink process owns the TTY and signal
# handling directly. `q` / Ctrl+C exit it cleanly (alt-screen buffer restored).
exec node "$TUI_ENTRY" "$@"
